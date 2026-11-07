import { first, all, run, json, authenticate } from '../utils/d1.js';

export async function medicineRoutes(request, env, path, db) {
  const parts = path.split('/').filter(Boolean);
  const method = request.method;
  const segment = parts[0] || '';
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  if (method === 'GET' && segment === 'categories') {
    const categories = await all(db, 'SELECT * FROM medicine_categories ORDER BY name');
    return json(categories);
  }

  if (method === 'GET' && segment === 'low-stock') {
    const threshold = parseInt(searchParams.get('threshold')) || 10;
    const results = await all(
      db,
      `SELECT m.*, mc.name as category_name, COALESCE(SUM(b.quantity), 0) as total_stock
       FROM medicines m
       LEFT JOIN medicine_categories mc ON mc.id = m.category_id
       LEFT JOIN batches b ON b.medicine_id = m.id AND b.quantity > 0
       WHERE m.is_active = 1
       GROUP BY m.id
       HAVING total_stock <= ?
       ORDER BY total_stock ASC`,
      [threshold]
    );
    return json(results);
  }

  if (method === 'GET' && segment === 'expiry') {
    const days = parseInt(searchParams.get('days')) || 90;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const results = await all(
      db,
      `SELECT b.*, m.brand_name, m.id as medicine_id
       FROM batches b
       JOIN medicines m ON m.id = b.medicine_id
       WHERE b.expiry_date <= ? AND b.quantity > 0 AND m.is_active = 1
       ORDER BY b.expiry_date ASC`,
      [futureDateStr]
    );
    return json(results);
  }

  if (method === 'GET' && !segment) {
    const search = searchParams.get('search') || '';
    const category_id = searchParams.get('category_id') || '';
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = (page - 1) * limit;

    let where = 'WHERE m.is_active = 1';
    const params = [];

    if (search) {
      where += ' AND (m.brand_name LIKE ? OR m.barcode LIKE ? OR m.generic_name LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (category_id) {
      where += ' AND m.category_id = ?';
      params.push(parseInt(category_id));
    }

    const countRow = await first(db, `SELECT COUNT(*) as total FROM medicines m ${where}`, params);
    const total = countRow ? countRow.total : 0;

    const medicines = await all(
      db,
      `SELECT m.*, 
              m.brand_name as name, 
              m.default_selling_price as unit_price, 
              m.prescription_required as requires_prescription,
              mc.name as category_name, 
              COALESCE(SUM(b.quantity), 0) as total_stock,
              COALESCE(SUM(b.quantity), 0) as current_stock
       FROM medicines m
       LEFT JOIN medicine_categories mc ON mc.id = m.category_id
       LEFT JOIN batches b ON b.medicine_id = m.id AND b.quantity > 0
       ${where}
       GROUP BY m.id
       ORDER BY m.brand_name
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return json({ medicines, total, page, limit, totalPages: Math.ceil(total / limit) });
  }

  if (method === 'GET' && segment && segment !== 'categories' && segment !== 'low-stock' && segment !== 'expiry') {
    const id = parseInt(segment);
    if (isNaN(id)) {
      return json({ error: 'Invalid ID' }, 400);
    }

    const medicine = await first(
      db,
      `SELECT m.*, mc.name as category_name
       FROM medicines m
       LEFT JOIN medicine_categories mc ON mc.id = m.category_id
       WHERE m.id = ? AND m.is_active = 1`,
      [id]
    );
    if (!medicine) {
      return json({ error: 'Medicine not found' }, 404);
    }

    const batches = await all(
      db,
      'SELECT * FROM batches WHERE medicine_id = ? AND quantity > 0 ORDER BY expiry_date ASC',
      [id]
    );

    return json({ ...medicine, batches });
  }

  if (method === 'POST' && !segment) {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const brand_name = body.brand_name || body.name;
    const generic_name = body.generic_name || brand_name;
    const strength = body.strength || '';
    const dosage_form = body.dosage_form || 'Tablet';
    let category_id = body.category_id ? parseInt(body.category_id) : null;
    if (!category_id && body.category) {
      const cat = await first(db, 'SELECT id FROM medicine_categories WHERE name = ? OR id = ?', [body.category, body.category]);
      if (cat) category_id = cat.id;
    }
    const manufacturer = body.manufacturer || 'Cosmos Pharmaceuticals';
    const supplier_id = body.supplier_id ? parseInt(body.supplier_id) : 1;
    let barcode = body.barcode ? String(body.barcode).trim() : null;
    if (!barcode) {
      barcode = 'PH' + Math.floor(10000000 + Math.random() * 89999999);
    }
    const unit = body.unit || 'tablet';
    const default_selling_price = Number(body.default_selling_price ?? body.unit_price ?? 10);
    const purchase_price = Number(body.purchase_price ?? Math.round(default_selling_price * 0.65));
    const vat_rate = Number(body.vat_rate ?? 16);
    const prescription_required = (body.prescription_required || body.requires_prescription) ? 1 : 0;
    const controlled_drug = body.controlled_drug ? 1 : 0;
    const storage_requirements = body.storage_requirements || 'Store below 25°C';
    const description = body.description || null;
    const alternative_brands = body.alternative_brands || null;

    if (!brand_name) {
      return json({ error: 'Medicine brand or generic name is required' }, 400);
    }

    // Check barcode uniqueness
    if (barcode) {
      const existing = await first(db, 'SELECT id FROM medicines WHERE barcode = ? AND is_active = 1', [barcode]);
      if (existing) {
        barcode = 'PH' + Math.floor(10000000 + Math.random() * 89999999);
      }
    }

    const now = new Date().toISOString();
    const info = await run(
      db,
      `INSERT INTO medicines (
        brand_name, generic_name, strength, dosage_form, category_id,
        manufacturer, supplier_id, barcode, unit, default_selling_price,
        purchase_price, vat_rate, prescription_required, controlled_drug,
        storage_requirements, description, alternative_brands, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        brand_name, generic_name, strength, dosage_form, category_id || null,
        manufacturer, supplier_id, barcode, unit, default_selling_price,
        purchase_price, vat_rate, prescription_required, controlled_drug,
        storage_requirements, description, alternative_brands, now
      ]
    );

    const medId = info.lastInsertRowid;

    // If initial stock or quantity was provided, auto-create a batch
    const initialQty = Number(body.initial_stock ?? body.quantity ?? 0);
    if (initialQty > 0) {
      const batchNumber = body.batch_number || `BN-${new Date().getFullYear()}-${String(medId).padStart(3, '0')}`;
      const expiryDate = body.expiry_date || new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      await run(
        db,
        `INSERT INTO batches (medicine_id, batch_number, quantity, initial_quantity, purchase_price, selling_price, expiry_date, supplier_id, branch_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'active', ?)`,
        [medId, batchNumber, initialQty, initialQty, purchase_price, default_selling_price, expiryDate, supplier_id, now]
      );
    }

    const medicine = await first(
      db,
      `SELECT m.*, 
              m.brand_name as name, 
              m.default_selling_price as unit_price, 
              m.prescription_required as requires_prescription,
              mc.name as category_name, 
              COALESCE(SUM(b.quantity), 0) as total_stock,
              COALESCE(SUM(b.quantity), 0) as current_stock
       FROM medicines m
       LEFT JOIN medicine_categories mc ON mc.id = m.category_id
       LEFT JOIN batches b ON b.medicine_id = m.id AND b.quantity > 0
       WHERE m.id = ?
       GROUP BY m.id`,
      [medId]
    );

    return json(medicine, 201);
  }

  if (method === 'PUT' && segment) {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const id = parseInt(segment);
    if (isNaN(id)) {
      return json({ error: 'Invalid ID' }, 400);
    }

    const existing = await first(db, 'SELECT id FROM medicines WHERE id = ? AND is_active = 1', [id]);
    if (!existing) {
      return json({ error: 'Medicine not found' }, 404);
    }

    const body = await request.json().catch(() => ({}));
    const {
      brand_name, generic_name, strength, dosage_form, category_id, manufacturer,
      supplier_id, barcode, kemsa_code, ppb_registration, unit,
      default_selling_price, purchase_price, vat_rate, prescription_required,
      controlled_drug, image, description, storage_requirements,
      drug_interactions, allergy_alerts, alternative_brands, is_active
    } = body;

    const now = new Date().toISOString();

    await run(
      db,
      `UPDATE medicines SET
        brand_name = COALESCE(?, brand_name),
        generic_name = COALESCE(?, generic_name),
        strength = COALESCE(?, strength),
        dosage_form = COALESCE(?, dosage_form),
        category_id = COALESCE(?, category_id),
        manufacturer = COALESCE(?, manufacturer),
        supplier_id = COALESCE(?, supplier_id),
        barcode = COALESCE(?, barcode),
        kemsa_code = COALESCE(?, kemsa_code),
        ppb_registration = COALESCE(?, ppb_registration),
        unit = COALESCE(?, unit),
        default_selling_price = COALESCE(?, default_selling_price),
        purchase_price = COALESCE(?, purchase_price),
        vat_rate = COALESCE(?, vat_rate),
        prescription_required = COALESCE(?, prescription_required),
        controlled_drug = COALESCE(?, controlled_drug),
        image = COALESCE(?, image),
        description = COALESCE(?, description),
        storage_requirements = COALESCE(?, storage_requirements),
        drug_interactions = COALESCE(?, drug_interactions),
        allergy_alerts = COALESCE(?, allergy_alerts),
        alternative_brands = COALESCE(?, alternative_brands),
        is_active = COALESCE(?, is_active),
        updated_at = ?
       WHERE id = ?`,
      [
        brand_name, generic_name, strength, dosage_form, category_id, manufacturer,
        supplier_id, barcode, kemsa_code, ppb_registration, unit,
        default_selling_price, purchase_price, vat_rate,
        prescription_required !== undefined ? (prescription_required ? 1 : 0) : null,
        controlled_drug !== undefined ? (controlled_drug ? 1 : 0) : null,
        image, description, storage_requirements, drug_interactions,
        allergy_alerts, alternative_brands,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        now, id
      ]
    );

    const medicine = await first(db, 'SELECT * FROM medicines WHERE id = ?', [id]);
    return json(medicine);
  }

  if (method === 'DELETE' && segment) {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const id = parseInt(segment);
    if (isNaN(id)) {
      return json({ error: 'Invalid ID' }, 400);
    }

    const existing = await first(db, 'SELECT id FROM medicines WHERE id = ? AND is_active = 1', [id]);
    if (!existing) {
      return json({ error: 'Medicine not found' }, 404);
    }

    await run(db, 'UPDATE medicines SET is_active = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    return json({ message: 'Medicine deactivated' });
  }

  return json({ error: 'Not found' }, 404);
}
