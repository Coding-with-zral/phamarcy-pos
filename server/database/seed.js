import db from './connection.js';
import { initializeDatabase } from './schema.js';
import { kenyanMedicines, medicineCategories } from '../data/kenyan-medicines.js';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('Initializing database schema...');
  await initializeDatabase();

  console.log('Seeding medicine categories...');
  const insertCategory = db.prepare('INSERT OR IGNORE INTO medicine_categories (name, description) VALUES (?, ?)');
  const categoryMap = {};

  for (const cat of medicineCategories) {
    insertCategory.run(cat.name, cat.description);
    const row = db.prepare('SELECT id FROM medicine_categories WHERE name = ?').get(cat.name);
    if (row) categoryMap[cat.name] = row.id;
  }

  console.log(`Seeded ${medicineCategories.length} categories`);

  console.log('Seeding Kenyan medicines...');
  const insertMedicine = db.prepare(`
    INSERT OR IGNORE INTO medicines (
      brand_name, generic_name, strength, dosage_form, category_id,
      manufacturer, unit, default_selling_price, barcode,
      prescription_required, controlled_drug, storage_requirements,
      alternative_brands, purchase_price, vat_rate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 16)
  `);

  let count = 0;
  for (const med of kenyanMedicines) {
    const barcode = 'PH' + Math.floor(100000000 + Math.random() * 900000000).toString();
    insertMedicine.run(
      med.brand_name,
      med.generic_name,
      med.strength || '',
      med.dosage_form || '',
      categoryMap[med.category] || null,
      med.manufacturer || '',
      med.unit || 'tablet',
      med.default_selling_price || 0,
      barcode,
      med.prescription_required || 0,
      med.controlled_drug || 0,
      med.storage_requirements || '',
      med.alternative_brands || '',
      Math.round((med.default_selling_price || 0) * 0.6)
    );
    count++;
  }

  console.log(`Seeded ${count} medicines`);

  // Seed default users
  console.log('Seeding default users...');
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, email, password, full_name, role) VALUES (?, ?, ?, ?, ?)');
  insertUser.run('admin', 'admin@hauzral.co.ke', bcrypt.hashSync('admin123', 10), 'System Administrator', 'admin');
  insertUser.run('cashier', 'cashier@hauzral.co.ke', bcrypt.hashSync('cashier123', 10), 'Default Cashier', 'cashier');
  insertUser.run('pharmacist', 'pharmacist@hauzral.co.ke', bcrypt.hashSync('pharmacist123', 10), 'Chief Pharmacist', 'pharmacist');

  // Seed default branch
  db.prepare('INSERT OR IGNORE INTO branches (name, address, phone) VALUES (?, ?, ?)').run('Main Branch', 'Kenyatta Avenue, Nairobi', '+254 700 000 000');

  // Seed suppliers
  const suppliers = [
    { name: 'Lab & Allied', contact_person: 'John Kamau', phone: '+254 722 111 222', email: 'orders@laballied.co.ke', address: 'Industrial Area, Nairobi' },
    { name: 'Phillips Pharmaceuticals', contact_person: 'Mary Wanjiku', phone: '+254 733 333 444', email: 'supply@phillips.co.ke', address: 'Westlands, Nairobi' },
    { name: 'Medisel Kenya', contact_person: 'Peter Ochieng', phone: '+254 712 555 666', email: 'orders@medisel.co.ke', address: 'Mombasa Road, Nairobi' },
    { name: 'Cosmos Pharmaceuticals', contact_person: 'Grace Muthoni', phone: '+254 700 777 888', email: 'supply@cosmos.co.ke', address: 'Nairobi' },
    { name: 'Dawa Limited', contact_person: 'James Mwangi', phone: '+254 722 999 000', email: 'orders@dawa.co.ke', address: 'Athi River' },
  ];

  const insertSupplier = db.prepare('INSERT OR IGNORE INTO suppliers (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)');
  for (const s of suppliers) {
    insertSupplier.run(s.name, s.contact_person, s.phone, s.email, s.address);
  }

  // Seed settings
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value, category) VALUES (?, ?, ?)');
  insertSetting.run('pharmacy_name', 'Hauzral Pharmacy', 'general');
  insertSetting.run('pharmacy_phone', '+254 700 123 456', 'general');
  insertSetting.run('pharmacy_address', 'Kenyatta Avenue, Nairobi', 'general');
  insertSetting.run('pharmacy_email', 'info@hauzral.co.ke', 'general');
  insertSetting.run('currency', 'KES', 'financial');
  insertSetting.run('vat_rate', '16', 'financial');
  insertSetting.run('receipt_footer', 'Thank you for choosing Hauzral Pharmacy!', 'receipt');
  insertSetting.run('low_stock_threshold', '20', 'inventory');
  insertSetting.run('expiry_alert_days', '90', 'inventory');

  db.save();

  console.log('Default users, branches, suppliers, and settings seeded');
  console.log('Seed completed successfully!');
  console.log('');
  console.log('Default Login Credentials:');
  console.log('Admin: admin / admin123');
  console.log('Pharmacist: pharmacist / pharmacist123');
  console.log('Cashier: cashier / cashier123');
}

seed().catch(console.error);
