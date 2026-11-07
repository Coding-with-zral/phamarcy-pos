import { first, all, run, json, authenticate } from '../utils/d1.js';

export async function supplierRoutes(request, env, path, db) {
  const parts = path.split('/').filter(Boolean);
  const method = request.method;
  const segment = parts[0] || '';
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  if (method === 'GET' && segment === 'purchases') {
    const supplierId = searchParams.get('supplier_id');
    let sql = `SELECT p.*, s.name as supplier_name, u.full_name as user_name
               FROM purchases p
               LEFT JOIN suppliers s ON s.id = p.supplier_id
               LEFT JOIN users u ON u.id = p.user_id`;
    const params = [];
    if (supplierId) {
      sql += ' WHERE p.supplier_id = ?';
      params.push(parseInt(supplierId));
    }
    sql += ' ORDER BY p.created_at DESC';
    const purchases = await all(db, sql, params);
    return json(purchases);
  }

  if (method === 'POST' && segment === 'purchases') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const { supplier_id, branch_id, items, invoice_number, amount_paid, status, notes } = body;

    if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
      return json({ error: 'supplier_id and items are required' }, 400);
    }

    let totalAmount = 0;
    for (const item of items) {
      totalAmount += (item.quantity || 0) * (item.purchase_price || 0);
    }

    const now = new Date().toISOString();
    const info = await run(
      db,
      `INSERT INTO purchases (supplier_id, branch_id, user_id, invoice_number, total_amount, amount_paid, status, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        supplier_id, branch_id || null, authUser.id,
        invoice_number || null, totalAmount, amount_paid || 0,
        status || 'pending', notes || null, now
      ]
    );

    const purchaseId = info.lastInsertRowid;

    for (const item of items) {
      const subtotal = (item.quantity || 0) * (item.purchase_price || 0);
      await run(
        db,
        `INSERT INTO purchase_items (purchase_id, medicine_id, batch_number, quantity, purchase_price, selling_price, expiry_date, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchaseId, item.medicine_id, item.batch_number || null,
          item.quantity, item.purchase_price || 0, item.selling_price || 0,
          item.expiry_date || null, subtotal
        ]
      );

      if (item.batch_number && item.medicine_id) {
        await run(
          db,
          `INSERT INTO batches (medicine_id, batch_number, quantity, initial_quantity, purchase_price, selling_price, expiry_date, supplier_id, purchase_id, branch_id, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
          [
            item.medicine_id, item.batch_number, item.quantity, item.quantity,
            item.purchase_price || 0, item.selling_price || 0,
            item.expiry_date || null, supplier_id, purchaseId,
            branch_id || null, now
          ]
        );
      }
    }

    const purchase = await first(db, 'SELECT * FROM purchases WHERE id = ?', [purchaseId]);
    const purchaseItems = await all(db, 'SELECT pi.*, m.brand_name FROM purchase_items pi JOIN medicines m ON m.id = pi.medicine_id WHERE pi.purchase_id = ?', [purchaseId]);

    return json({ ...purchase, items: purchaseItems }, 201);
  }

  if (method === 'GET' && segment === 'payments') {
    const supplierId = searchParams.get('supplier_id');
    let sql = `SELECT pay.*, s.name as supplier_name
               FROM payments pay
               JOIN suppliers s ON s.id = pay.supplier_id
               WHERE pay.supplier_id IS NOT NULL`;
    const params = [];
    if (supplierId) {
      sql = `SELECT pay.*, s.name as supplier_name
             FROM payments pay
             JOIN suppliers s ON s.id = pay.supplier_id
             WHERE pay.supplier_id = ?`;
      params.push(parseInt(supplierId));
    }
    sql += ' ORDER BY pay.created_at DESC';
    const payments = await all(db, sql, params);
    return json(payments);
  }

  if (method === 'POST' && segment === 'payments') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const { supplier_id, amount, method: payMethod, reference, notes } = body;

    if (!supplier_id || !amount) {
      return json({ error: 'supplier_id and amount are required' }, 400);
    }

    const supplier = await first(db, 'SELECT id FROM suppliers WHERE id = ? AND is_active = 1', [supplier_id]);
    if (!supplier) {
      return json({ error: 'Supplier not found' }, 404);
    }

    const now = new Date().toISOString();
    const info = await run(
      db,
      `INSERT INTO payments (supplier_id, amount, method, reference, status, notes, created_at)
       VALUES (?, ?, ?, ?, 'completed', ?, ?)`,
      [supplier_id, amount, payMethod || 'cash', reference || null, notes || null, now]
    );

    await run(
      db,
      'UPDATE suppliers SET outstanding_balance = MAX(0, outstanding_balance - ?) WHERE id = ?',
      [amount, supplier_id]
    );

    const payment = await first(db, 'SELECT * FROM payments WHERE id = ?', [info.lastInsertRowid]);
    return json(payment, 201);
  }

  if (method === 'GET' && !segment) {
    const search = searchParams.get('search') || '';
    let where = 'WHERE is_active = 1';
    const params = [];

    if (search) {
      where += ' AND (name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const suppliers = await all(db, `SELECT * FROM suppliers ${where} ORDER BY name`, params);
    return json(suppliers);
  }

  if (method === 'GET' && segment && segment !== 'purchases' && segment !== 'payments') {
    const id = parseInt(segment);
    if (isNaN(id)) {
      return json({ error: 'Invalid ID' }, 400);
    }

    const supplier = await first(db, 'SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!supplier) {
      return json({ error: 'Supplier not found' }, 404);
    }

    const recentPayments = await all(
      db,
      'SELECT * FROM payments WHERE supplier_id = ? ORDER BY created_at DESC LIMIT 10',
      [id]
    );

    const recentPurchases = await all(
      db,
      'SELECT * FROM purchases WHERE supplier_id = ? ORDER BY created_at DESC LIMIT 10',
      [id]
    );

    return json({ ...supplier, recent_payments: recentPayments, recent_purchases: recentPurchases });
  }

  if (method === 'POST' && !segment) {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const { name, contact_person, phone, email, address, city, payment_terms } = body;

    if (!name) {
      return json({ error: 'Name is required' }, 400);
    }

    const now = new Date().toISOString();
    const info = await run(
      db,
      `INSERT INTO suppliers (name, contact_person, phone, email, address, city, outstanding_balance, payment_terms, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, 1, ?)`,
      [name, contact_person || null, phone || null, email || null, address || null, city || null, payment_terms || null, now]
    );

    const supplier = await first(db, 'SELECT * FROM suppliers WHERE id = ?', [info.lastInsertRowid]);
    return json(supplier, 201);
  }

  if (method === 'PUT' && segment && segment !== 'purchases' && segment !== 'payments') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const id = parseInt(segment);
    if (isNaN(id)) {
      return json({ error: 'Invalid ID' }, 400);
    }

    const existing = await first(db, 'SELECT id FROM suppliers WHERE id = ?', [id]);
    if (!existing) {
      return json({ error: 'Supplier not found' }, 404);
    }

    const body = await request.json().catch(() => ({}));
    const { name, contact_person, phone, email, address, city, payment_terms, is_active } = body;

    await run(
      db,
      `UPDATE suppliers SET
        name = COALESCE(?, name),
        contact_person = COALESCE(?, contact_person),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        payment_terms = COALESCE(?, payment_terms),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, contact_person, phone, email, address, city, payment_terms,
       is_active !== undefined ? (is_active ? 1 : 0) : null, id]
    );

    const supplier = await first(db, 'SELECT * FROM suppliers WHERE id = ?', [id]);
    return json(supplier);
  }

  if (method === 'DELETE' && segment && segment !== 'purchases' && segment !== 'payments') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const id = parseInt(segment);
    if (isNaN(id)) {
      return json({ error: 'Invalid ID' }, 400);
    }

    const existing = await first(db, 'SELECT id FROM suppliers WHERE id = ?', [id]);
    if (!existing) {
      return json({ error: 'Supplier not found' }, 404);
    }

    await run(db, 'UPDATE suppliers SET is_active = 0 WHERE id = ?', [id]);
    return json({ message: 'Supplier deactivated' });
  }

  return json({ error: 'Not found' }, 404);
}
