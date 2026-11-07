import { kenyanMedicines, medicineCategories } from '../data/kenyan-medicines.js';

const TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
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
  )`,
  `CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    manager_id INTEGER REFERENCES users(id),
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS medicine_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS suppliers (
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
  )`,
  `CREATE TABLE IF NOT EXISTS medicines (
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
    image TEXT,
    description TEXT,
    storage_requirements TEXT,
    drug_interactions TEXT,
    allergy_alerts TEXT,
    alternative_brands TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id INTEGER NOT NULL,
    batch_number TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    initial_quantity INTEGER NOT NULL DEFAULT 0,
    purchase_price REAL NOT NULL,
    selling_price REAL NOT NULL,
    expiry_date TEXT NOT NULL,
    supplier_id INTEGER,
    purchase_id INTEGER,
    branch_id INTEGER,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    branch_id INTEGER,
    user_id INTEGER NOT NULL,
    invoice_number TEXT,
    total_amount REAL NOT NULL DEFAULT 0,
    amount_paid REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    medicine_id INTEGER NOT NULL,
    batch_number TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    purchase_price REAL NOT NULL,
    selling_price REAL NOT NULL,
    expiry_date TEXT NOT NULL,
    subtotal REAL NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS customers (
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
  )`,
  `CREATE TABLE IF NOT EXISTS prescriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    doctor_name TEXT NOT NULL,
    doctor_license TEXT,
    hospital TEXT,
    prescription_date TEXT NOT NULL,
    diagnosis TEXT,
    notes TEXT,
    image TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS prescription_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prescription_id INTEGER NOT NULL,
    medicine_id INTEGER NOT NULL,
    dosage TEXT,
    frequency TEXT,
    duration TEXT,
    quantity_prescribed INTEGER,
    quantity_dispensed INTEGER DEFAULT 0,
    notes TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    user_id INTEGER NOT NULL,
    branch_id INTEGER,
    prescription_id INTEGER,
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
  )`,
  `CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    medicine_id INTEGER NOT NULL,
    batch_id INTEGER,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    discount REAL DEFAULT 0,
    subtotal REAL NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    purchase_id INTEGER,
    customer_id INTEGER,
    supplier_id INTEGER,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    reference TEXT,
    status TEXT DEFAULT 'completed',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS insurance_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    claim_percentage REAL DEFAULT 80,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS insurance_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    customer_id INTEGER,
    insurance_provider_id INTEGER,
    claim_amount REAL NOT NULL,
    approved_amount REAL,
    claim_number TEXT,
    status TEXT DEFAULT 'pending',
    submitted_date TEXT,
    resolved_date TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS stock_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_branch_id INTEGER NOT NULL,
    to_branch_id INTEGER NOT NULL,
    medicine_id INTEGER NOT NULL,
    batch_id INTEGER,
    quantity INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    transferred_by INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id INTEGER NOT NULL,
    batch_id INTEGER,
    adjustment_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    reason TEXT,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    description TEXT,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    user_id INTEGER,
    branch_id INTEGER,
    receipt TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'normal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    category TEXT DEFAULT 'general',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
];

const SEED_USERS = [
  ['admin', 'admin@hauzral.co.ke', '$2a$10$N4uy3FI8YLR9wGSBgy5a8uAsLDQl9UfhJQEPZbCrtXE/ISjQeP2oW', 'System Admin', 'admin', '+254700000000', 1],
  ['pharmacist', 'pharmacist@hauzral.co.ke', '$2a$10$AoNxuP9TpYEjENASuAQx4ezaYRyGEox7Oz2OLgZ35YaArzemwd80e', 'Chief Pharmacist', 'pharmacist', '+254700000001', 1],
  ['cashier', 'cashier@hauzral.co.ke', '$2a$10$PZwhUMLSzXl2M1SOf4AM5O8wn4TmYH7dTIuaJiavR0r4KDBcluEWu', 'Cashier', 'cashier', '+254700000002', 1],
];

export async function initializeDatabase(db) {
  const tableStmts = TABLES.map(sql => db.prepare(sql));
  await db.batch(tableStmts);

  const catIdMap = {};
  const catStmts = medicineCategories.map(cat => {
    catIdMap[cat.name] = null;
    return db.prepare(`INSERT OR IGNORE INTO medicine_categories (name, description) VALUES (?, ?)`)
      .bind(cat.name, cat.description);
  });
  await db.batch(catStmts);

  const catRows = await db.prepare(`SELECT id, name FROM medicine_categories`).all();
  if (catRows.results) {
    for (const row of catRows.results) {
      catIdMap[row.name] = row.id;
    }
  }

  const userStmts = SEED_USERS.map(u =>
    db.prepare(`INSERT OR IGNORE INTO users (username, email, password, full_name, role, phone, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(...u)
  );
  userStmts.push(
    db.prepare(`INSERT OR IGNORE INTO branches (name, address, phone, is_active) VALUES (?, ?, ?, ?)`)
      .bind('Main Branch', 'Kenyatta Avenue, Nairobi', '+254700000000', 1)
  );
  await db.batch(userStmts);

  const medStmts = kenyanMedicines.map(med => {
    const categoryId = catIdMap[med.category] || null;
    const barcode = med.brand_name.replace(/\s+/g, '').substring(0, 8).toUpperCase() + Math.floor(Math.random() * 9000 + 1000);
    return db.prepare(
      `INSERT OR IGNORE INTO medicines (brand_name, generic_name, strength, dosage_form, category_id, manufacturer, unit, default_selling_price, purchase_price, vat_rate, prescription_required, controlled_drug, storage_requirements, alternative_brands, is_active, barcode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 16, ?, ?, ?, ?, 1, ?)`
    ).bind(
      med.brand_name, med.generic_name, med.strength || null, med.dosage_form || null,
      categoryId, med.manufacturer || null, med.unit || 'tablet',
      med.default_selling_price || 0, (med.default_selling_price || 0) * 0.7,
      med.prescription_required ? 1 : 0, med.controlled_drug ? 1 : 0,
      med.storage_requirements || null, med.alternative_brands || null, barcode
    );
  });
  await db.batch(medStmts);
}
