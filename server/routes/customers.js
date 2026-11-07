import { first, all, run, json, authenticate } from '../utils/d1.js';

export async function customerRoutes(request, env, path, db) {
  const parts = path.split('/').filter(Boolean);
  const method = request.method;
  const segment = parts[0] || '';
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  if (method === 'GET' && !segment) {
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = (page - 1) * limit;

    let where = 'WHERE is_active = 1';
    const params = [];

    if (search) {
      where += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const countRow = await first(db, `SELECT COUNT(*) as total FROM customers ${where}`, params);
    const total = countRow ? countRow.total : 0;

    const customers = await all(
      db,
      `SELECT * FROM customers ${where} ORDER BY name LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return json({ customers, total, page, limit, totalPages: Math.ceil(total / limit) });
  }

  if (method === 'GET' && segment) {
    const id = parseInt(segment);
    if (isNaN(id)) {
      return json({ error: 'Invalid ID' }, 400);
    }

    const customer = await first(db, 'SELECT * FROM customers WHERE id = ?', [id]);
    if (!customer) {
      return json({ error: 'Customer not found' }, 404);
    }

    const recentSales = await all(
      db,
      `SELECT id, total_amount, payment_method, created_at
       FROM sales WHERE customer_id = ? AND status = 'completed'
       ORDER BY created_at DESC LIMIT 10`,
      [id]
    );

    return json({ ...customer, recent_sales: recentSales });
  }

  if (method === 'POST' && !segment) {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const {
      name, phone, email, address, date_of_birth, medical_notes,
      allergies, insurance_provider, insurance_number
    } = body;

    if (!name) {
      return json({ error: 'Name is required' }, 400);
    }

    const now = new Date().toISOString();
    const info = await run(
      db,
      `INSERT INTO customers (name, phone, email, address, date_of_birth, medical_notes, allergies, loyalty_points, insurance_provider, insurance_number, total_purchases, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 1, ?)`,
      [
        name, phone || null, email || null, address || null,
        date_of_birth || null, medical_notes || null, allergies || null,
        insurance_provider || null, insurance_number || null, now
      ]
    );

    const customer = await first(db, 'SELECT * FROM customers WHERE id = ?', [info.lastInsertRowid]);
    return json(customer, 201);
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

    const existing = await first(db, 'SELECT id FROM customers WHERE id = ?', [id]);
    if (!existing) {
      return json({ error: 'Customer not found' }, 404);
    }

    const body = await request.json().catch(() => ({}));
    const {
      name, phone, email, address, date_of_birth, medical_notes,
      allergies, insurance_provider, insurance_number, is_active
    } = body;

    await run(
      db,
      `UPDATE customers SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        date_of_birth = COALESCE(?, date_of_birth),
        medical_notes = COALESCE(?, medical_notes),
        allergies = COALESCE(?, allergies),
        insurance_provider = COALESCE(?, insurance_provider),
        insurance_number = COALESCE(?, insurance_number),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        name, phone, email, address, date_of_birth, medical_notes,
        allergies, insurance_provider, insurance_number,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        id
      ]
    );

    const customer = await first(db, 'SELECT * FROM customers WHERE id = ?', [id]);
    return json(customer);
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

    const existing = await first(db, 'SELECT id FROM customers WHERE id = ?', [id]);
    if (!existing) {
      return json({ error: 'Customer not found' }, 404);
    }

    await run(db, 'UPDATE customers SET is_active = 0 WHERE id = ?', [id]);
    return json({ message: 'Customer deactivated' });
  }

  return json({ error: 'Not found' }, 404);
}
