import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { kenyanMedicines, medicineCategories } from '../data/kenyan-medicines.js';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'pharmacy.db');
const sqlite = new DatabaseSync(DB_PATH);

// Create D1-compatible database wrapper
export const db = {
  raw: sqlite,
  prepare(sql) {
    try {
      const stmt = sqlite.prepare(sql);
      const createRunner = (args = []) => ({
        first: async () => {
          try {
            const row = stmt.get(...args);
            return row || undefined;
          } catch (e) {
            console.error('SQLite get error:', e.message, 'SQL:', sql);
            return undefined;
          }
        },
        all: async () => {
          try {
            const results = stmt.all(...args);
            return { results: results || [] };
          } catch (e) {
            console.error('SQLite all error:', e.message, 'SQL:', sql);
            return { results: [] };
          }
        },
        run: async () => {
          try {
            const info = stmt.run(...args);
            return {
              meta: {
                changes: info.changes || 0,
                last_row_id: Number(info.lastInsertRowid) || 0,
              },
              lastInsertRowid: Number(info.lastInsertRowid) || 0,
            };
          } catch (e) {
            console.error('SQLite run error:', e.message, 'SQL:', sql);
            throw e;
          }
        },
      });

      return {
        bind: (...args) => createRunner(args),
        first: () => createRunner().first(),
        all: () => createRunner().all(),
        run: () => createRunner().run(),
      };
    } catch (err) {
      console.error('SQLite prepare error:', err.message, 'SQL:', sql);
      throw err;
    }
  },
  exec: async (sql) => {
    try {
      sqlite.exec(sql);
    } catch (e) {
      console.error('SQLite exec error:', e.message);
      throw e;
    }
  },
  batch: async (stmts) => {
    for (const s of stmts) {
      if (s && typeof s.run === 'function') {
        await s.run();
      }
    }
  },
};

export async function setupDatabase() {
  sqlite.exec('PRAGMA foreign_keys = ON;');

  // Create tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier',
      phone TEXT,
      avatar TEXT,
      is_active INTEGER DEFAULT 1,
      two_factor_enabled INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      manager_id INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medicine_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      outstanding_balance REAL DEFAULT 0,
      payment_terms TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_name TEXT NOT NULL,
      generic_name TEXT NOT NULL,
      strength TEXT,
      dosage_form TEXT,
      category_id INTEGER REFERENCES medicine_categories(id),
      manufacturer TEXT,
      supplier_id INTEGER REFERENCES suppliers(id),
      barcode TEXT UNIQUE,
      kemsa_code TEXT,
      ppb_registration TEXT,
      unit TEXT DEFAULT 'tablet',
      default_selling_price REAL NOT NULL,
      purchase_price REAL DEFAULT 0,
      vat_rate REAL DEFAULT 16,
      prescription_required INTEGER DEFAULT 0,
      controlled_drug INTEGER DEFAULT 0,
      storage_requirements TEXT,
      description TEXT,
      alternative_brands TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER NOT NULL REFERENCES medicines(id),
      batch_number TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      initial_quantity INTEGER NOT NULL DEFAULT 0,
      purchase_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      manufacture_date TEXT,
      expiry_date TEXT NOT NULL,
      supplier_id INTEGER REFERENCES suppliers(id),
      purchase_id INTEGER,
      branch_id INTEGER REFERENCES branches(id),
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      branch_id INTEGER REFERENCES branches(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      invoice_number TEXT,
      total_amount REAL NOT NULL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      status TEXT DEFAULT 'completed',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id),
      medicine_id INTEGER NOT NULL REFERENCES medicines(id),
      batch_number TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      purchase_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      expiry_date TEXT NOT NULL,
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE,
      email TEXT,
      address TEXT,
      date_of_birth TEXT,
      medical_notes TEXT,
      allergies TEXT,
      loyalty_points INTEGER DEFAULT 0,
      insurance_provider TEXT,
      insurance_number TEXT,
      total_purchases REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id),
      doctor_name TEXT NOT NULL,
      doctor_license TEXT,
      hospital TEXT,
      prescription_date TEXT NOT NULL,
      diagnosis TEXT,
      notes TEXT,
      image TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS prescription_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prescription_id INTEGER NOT NULL REFERENCES prescriptions(id),
      medicine_id INTEGER NOT NULL REFERENCES medicines(id),
      dosage TEXT,
      frequency TEXT,
      duration TEXT,
      quantity_prescribed INTEGER,
      quantity_dispensed INTEGER DEFAULT 0,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      branch_id INTEGER REFERENCES branches(id),
      prescription_id INTEGER REFERENCES prescriptions(id),
      subtotal REAL NOT NULL DEFAULT 0,
      vat_amount REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      amount_paid REAL DEFAULT 0,
      change_amount REAL DEFAULT 0,
      loyalty_points_earned INTEGER DEFAULT 0,
      loyalty_points_redeemed INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id),
      medicine_id INTEGER NOT NULL REFERENCES medicines(id),
      batch_id INTEGER REFERENCES batches(id),
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      discount REAL DEFAULT 0,
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER REFERENCES sales(id),
      purchase_id INTEGER REFERENCES purchases(id),
      customer_id INTEGER REFERENCES customers(id),
      supplier_id INTEGER REFERENCES suppliers(id),
      amount REAL NOT NULL,
      method TEXT NOT NULL,
      reference TEXT,
      status TEXT DEFAULT 'completed',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER NOT NULL REFERENCES medicines(id),
      batch_id INTEGER REFERENCES batches(id),
      adjustment_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reason TEXT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'normal',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      category TEXT DEFAULT 'general',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Alter users table if needed for password reset, pin, and last_login
  try { sqlite.exec('ALTER TABLE users ADD COLUMN reset_token TEXT;'); } catch {}
  try { sqlite.exec('ALTER TABLE users ADD COLUMN reset_expires TEXT;'); } catch {}
  try { sqlite.exec('ALTER TABLE users ADD COLUMN pin TEXT;'); } catch {}
  try { sqlite.exec('ALTER TABLE users ADD COLUMN last_login TEXT;'); } catch {}

  // Check if users already seeded
  const existingUser = sqlite.prepare('SELECT COUNT(*) as count FROM users').get();
  if (!existingUser || existingUser.count === 0) {
    console.log('Seeding initial pharmacy database...');

    // 1. Seed Users
    const insertUser = sqlite.prepare(`
      INSERT INTO users (username, email, password, full_name, role, phone, avatar, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    insertUser.run('admin', 'admin@hauzral.co.ke', bcrypt.hashSync('admin123', 10), 'Dr. Patrick Mwangi (Lead Pharmacist)', 'admin', '+254711000111', 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80');
    insertUser.run('pharmacist', 'pharmacist@hauzral.co.ke', bcrypt.hashSync('pharmacist123', 10), 'Sarah Wanjiku (Clinical Pharmacist)', 'pharmacist', '+254722000222', 'https://images.unsplash.com/photo-1594824813571-638f02614d3f?w=150&auto=format&fit=crop&q=80');
    insertUser.run('cashier', 'cashier@hauzral.co.ke', bcrypt.hashSync('cashier123', 10), 'Kevin Omondi (Head Cashier)', 'cashier', '+254733000333', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80');

    // 2. Seed Branch
    sqlite.prepare('INSERT INTO branches (name, address, phone, is_active) VALUES (?, ?, ?, 1)')
      .run('Hauzral Pharmacy - Flagship Nairobi', 'Kenyatta Avenue & Kimathi St, Nairobi CBD', '+254 700 888 999');

    // 3. Seed Suppliers
    const suppliersData = [
      { name: 'Cosmos Pharmaceuticals Ltd', person: 'Grace Muthoni', phone: '+254 700 777 888', email: 'supply@cosmos.co.ke', city: 'Nairobi', address: 'Rangwe Rd, Industrial Area' },
      { name: 'Lab & Allied Ltd', person: 'John Kamau', phone: '+254 722 111 222', email: 'orders@laballied.co.ke', city: 'Nairobi', address: 'Road C, off Enterprise Rd' },
      { name: 'Phillips Pharmaceuticals Ltd', person: 'Mary Wanjiku', phone: '+254 733 333 444', email: 'sales@phillips.co.ke', city: 'Nairobi', address: 'Parklands, Nairobi' },
      { name: 'Medisel Kenya Ltd', person: 'Peter Ochieng', phone: '+254 712 555 666', email: 'orders@medisel.co.ke', city: 'Nairobi', address: 'Mombasa Road' },
      { name: 'Dawa Lifesciences Ltd', person: 'James Mwangi', phone: '+254 722 999 000', email: 'orders@dawa.co.ke', city: 'Athi River', address: 'Dawa Complex, Athi River' },
    ];
    const insertSup = sqlite.prepare('INSERT INTO suppliers (name, contact_person, phone, email, city, address, outstanding_balance, payment_terms) VALUES (?, ?, ?, ?, ?, ?, 0, ?)');
    suppliersData.forEach(s => insertSup.run(s.name, s.person, s.phone, s.email, s.city, s.address, 'Net 30 Days'));

    // 4. Seed Categories
    const insertCat = sqlite.prepare('INSERT OR IGNORE INTO medicine_categories (name, description) VALUES (?, ?)');
    const catMap = {};
    for (const cat of medicineCategories) {
      insertCat.run(cat.name, cat.description);
      const row = sqlite.prepare('SELECT id FROM medicine_categories WHERE name = ?').get(cat.name);
      if (row) catMap[cat.name] = row.id;
    }

    // 5. Seed Medicines & Batches with realistic stock
    const insertMed = sqlite.prepare(`
      INSERT INTO medicines (
        brand_name, generic_name, strength, dosage_form, category_id,
        manufacturer, supplier_id, barcode, unit, default_selling_price,
        purchase_price, vat_rate, prescription_required, controlled_drug,
        storage_requirements, alternative_brands, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 16, ?, ?, ?, ?, 1)
    `);

    const insertBatch = sqlite.prepare(`
      INSERT INTO batches (
        medicine_id, batch_number, quantity, initial_quantity,
        purchase_price, selling_price, manufacture_date, expiry_date,
        supplier_id, branch_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active')
    `);

    let medId = 1;
    for (let i = 0; i < kenyanMedicines.length; i++) {
      const med = kenyanMedicines[i];
      const categoryId = catMap[med.category] || null;
      const supplierId = (i % 5) + 1;
      const barcode = 'PH' + String(10000000 + i).padStart(8, '0');
      const sellingPrice = med.default_selling_price || 10;
      const purchasePrice = Math.max(1, Math.round(sellingPrice * 0.65));

      insertMed.run(
        med.brand_name,
        med.generic_name,
        med.strength || '',
        med.dosage_form || 'Tablet',
        categoryId,
        med.manufacturer || 'Cosmos Pharmaceuticals',
        supplierId,
        barcode,
        med.unit || 'tablet',
        sellingPrice,
        purchasePrice,
        med.prescription_required ? 1 : 0,
        med.controlled_drug ? 1 : 0,
        med.storage_requirements || 'Store below 25°C',
        med.alternative_brands || ''
      );

      // Create 1-2 stock batches for each medicine
      // Most batches expire in 2027/2028; a few expire soon to demonstrate expiry monitoring!
      let expiryDate = '2027-11-30';
      let stockQty = Math.floor(Math.random() * 120) + 40; // 40 to 160 units

      if (i === 3 || i === 12) {
        // Expiring in 25-35 days for alert testing
        expiryDate = '2026-12-05';
      } else if (i === 7) {
        // Expiring in 60 days
        expiryDate = '2027-01-10';
      } else if (i === 15) {
        // Low stock item
        stockQty = 6;
      }

      insertBatch.run(
        medId,
        `BN-${2026}-${String(medId).padStart(3, '0')}A`,
        stockQty,
        stockQty + 20,
        purchasePrice,
        sellingPrice,
        '2025-01-15',
        expiryDate,
        supplierId
      );

      medId++;
    }

    // 6. Seed Customers (Patients)
    const customersData = [
      { name: 'Samuel Mwangi', phone: '+254712345678', email: 'samuel.m@gmail.com', allergies: 'Penicillin, Sulfa drugs', notes: 'Hypertension patient (refills Losartan monthly)', points: 140 },
      { name: 'Grace Achieng', phone: '+254723456789', email: 'grace.a@yahoo.com', allergies: 'None known', notes: 'Type 2 Diabetes (Metformin regular user)', points: 260 },
      { name: 'David Kipkorir', phone: '+254734567890', email: 'dkipkorir@gmail.com', allergies: 'Aspirin (Bronchospasm)', notes: 'Asthma patient (Salbutamol inhaler)', points: 95 },
      { name: 'Amina Hassan', phone: '+254745678901', email: 'amina.h@outlook.com', allergies: 'None', notes: 'Ante-natal supplements and vitamins', points: 310 },
      { name: 'Peter Ndung\'u', phone: '+254756789012', email: 'p.ndungu@gmail.com', allergies: 'Ciprofloxacin', notes: 'Corporate client - Britam Insurance', points: 80 },
    ];

    const insertCust = sqlite.prepare(`
      INSERT INTO customers (name, phone, email, allergies, medical_notes, loyalty_points, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    customersData.forEach(c => insertCust.run(c.name, c.phone, c.email, c.allergies, c.notes, c.points));

    // 7. Seed Prescriptions
    const insertRx = sqlite.prepare(`
      INSERT INTO prescriptions (customer_id, doctor_name, doctor_license, hospital, prescription_date, diagnosis, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertRx.run(1, 'Dr. Evans Otieno', 'KMPDC-88421', 'Nairobi Hospital', '2026-11-04', 'Essential Hypertension', 'Review blood pressure after 30 days', 'active');
    insertRx.run(2, 'Dr. Catherine Wangari', 'KMPDC-91204', 'Aga Khan University Hospital', '2026-11-03', 'Type 2 Diabetes Mellitus', 'Fasting blood sugar monitoring required', 'active');
    insertRx.run(3, 'Dr. Michael Kimani', 'KMPDC-77319', 'Kenyatta National Hospital', '2026-10-28', 'Acute Bronchial Asthma', 'Use inhaler as directed, avoid dust triggers', 'dispensed');

    // 8. Seed Prescription Items
    const insertRxItem = sqlite.prepare(`
      INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, duration, quantity_prescribed, quantity_dispensed, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertRxItem.run(1, 23, '50mg', 'Once daily in the morning', '30 days', 30, 0, 'Take with a glass of water');
    insertRxItem.run(2, 17, '500mg', 'Twice daily with meals', '30 days', 60, 0, 'Avoid skipping meals');
    insertRxItem.run(3, 4, '400mg', 'Three times daily after meals', '5 days', 15, 15, 'Completed course');

    // 9. Seed Recent Sales & Payments for rich reports
    const insertSale = sqlite.prepare(`
      INSERT INTO sales (customer_id, user_id, branch_id, subtotal, vat_amount, discount_amount, total_amount, payment_method, amount_paid, change_amount, loyalty_points_earned, status, created_at)
      VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
    `);
    const insertSaleItem = sqlite.prepare(`
      INSERT INTO sale_items (sale_id, medicine_id, batch_id, quantity, unit_price, discount, subtotal)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `);
    const insertPayment = sqlite.prepare(`
      INSERT INTO payments (sale_id, customer_id, amount, method, reference, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'completed', ?)
    `);

    // Create 8 realistic past transactions across the last few days
    const pastSales = [
      { cust: 1, user: 1, sub: 900, vat: 144, disc: 0, tot: 1044, method: 'mpesa', ref: 'QK982HY71B', date: '2026-11-05 14:22:00', items: [{ med: 1, batch: 1, qty: 20, price: 3 }, { med: 4, batch: 4, qty: 30, price: 5 }, { med: 18, batch: 18, qty: 20, price: 30 }] },
      { cust: 2, user: 2, sub: 1500, vat: 240, disc: 100, tot: 1640, method: 'cash', ref: 'CASH-REC-101', date: '2026-11-05 11:15:00', items: [{ med: 17, batch: 17, qty: 60, price: 5 }, { med: 22, batch: 22, qty: 30, price: 10 }] },
      { cust: 3, user: 3, sub: 650, vat: 104, disc: 0, tot: 754, method: 'mpesa', ref: 'QK971XW49A', date: '2026-11-04 16:45:00', items: [{ med: 3, batch: 3, qty: 40, price: 3 }, { med: 19, batch: 19, qty: 10, price: 25 }] },
      { cust: 4, user: 1, sub: 2400, vat: 384, disc: 0, tot: 2784, method: 'card', ref: 'VISA-40918', date: '2026-11-04 10:30:00', items: [{ med: 18, batch: 18, qty: 40, price: 30 }, { med: 7, batch: 7, qty: 10, price: 120 }] },
      { cust: 5, user: 2, sub: 450, vat: 72, disc: 0, tot: 522, method: 'cash', ref: 'CASH-REC-098', date: '2026-11-03 15:10:00', items: [{ med: 1, batch: 1, qty: 30, price: 3 }, { med: 8, batch: 8, qty: 20, price: 2 }] },
    ];

    let saleId = 1;
    for (const s of pastSales) {
      insertSale.run(s.cust, s.user, s.sub, s.vat, s.disc, s.tot, s.method, s.tot, 0, Math.floor(s.tot / 100), s.date);
      for (const item of s.items) {
        insertSaleItem.run(saleId, item.med, item.batch, item.qty, item.price, item.qty * item.price);
      }
      insertPayment.run(saleId, s.cust, s.tot, s.method, s.ref, s.date);
      saleId++;
    }

    // 10. Seed Notifications
    const insertNotif = sqlite.prepare(`
      INSERT INTO notifications (user_id, type, title, message, priority, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `);
    insertNotif.run(1, 'inventory', 'Near Expiry Alert: Lumartem 20/120mg', 'Batch BN-2026-004A expires on 2026-12-05 (in 29 days). Review stock for FEFO dispensing.', 'high', '2026-11-05 08:00:00');
    insertNotif.run(1, 'inventory', 'Low Stock Alert: Amoxicillin 500mg', 'Current stock is below reorder threshold (6 units left). Suggested reorder: 100 units.', 'high', '2026-11-05 09:30:00');
    insertNotif.run(1, 'prescription', 'New Prescription Awaiting Dispensing', 'Dr. Evans Otieno issued prescription #RX-1001 for Samuel Mwangi.', 'normal', '2026-11-05 10:15:00');

    // 11. Seed Settings
    const insertSetting = sqlite.prepare('INSERT OR REPLACE INTO settings (key, value, category) VALUES (?, ?, ?)');
    insertSetting.run('pharmacy_name', 'Hauzral Healthcare Pharmacy & Dispensary', 'general');
    insertSetting.run('pharmacy_address', 'Suite 104, Medical Plaza, Kenyatta Ave, Nairobi', 'general');
    insertSetting.run('pharmacy_phone', '+254 (0) 700 888 999 / +254 (0) 20 221 4455', 'general');
    insertSetting.run('pharmacy_email', 'dispensary@hauzral-pharmacy.co.ke', 'general');
    insertSetting.run('pharmacy_ppb_license', 'PPB/RET/2026/04918', 'regulatory');
    insertSetting.run('currency', 'KES', 'financial');
    insertSetting.run('currency_symbol', 'KSh', 'financial');
    insertSetting.run('vat_rate', '16', 'financial');
    insertSetting.run('receipt_header', 'HAUZRAL PHARMACY & HEALTHCARE SERVICES', 'receipt');
    insertSetting.run('receipt_footer', 'Thank you for choosing Hauzral Pharmacy! Goods once sold cannot be returned under Pharmacy & Poisons Board regulations.', 'receipt');
    insertSetting.run('receipt_pin', 'P051982734Z', 'receipt');
    insertSetting.run('low_stock_threshold', '15', 'inventory');
    insertSetting.run('expiry_alert_days', '90', 'inventory');
    insertSetting.run('allow_credit_sales', 'true', 'pos');
    insertSetting.run('enable_drug_interaction_checks', 'true', 'clinical');

    console.log('Seeded Hauzral Pharmacy database successfully!');
  }
}
