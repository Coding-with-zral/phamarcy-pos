import { first, all, run, json, authenticate } from '../utils/d1.js';

export async function prescriptionRoutes(request, env, path, db) {
  const parts = path.split('/').filter(Boolean);
  const method = request.method;
  const segment = parts[0] || '';
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  if (method === 'GET' && !segment) {
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];

    if (search) {
      where += ' AND (p.doctor_name LIKE ? OR p.diagnosis LIKE ? OR c.name LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (status) {
      where += ' AND p.status = ?';
      params.push(status);
    }

    const countRow = await first(db, `SELECT COUNT(*) as total FROM prescriptions p LEFT JOIN customers c ON c.id = p.customer_id ${where}`, params);
    const total = countRow ? countRow.total : 0;

    const prescriptions = await all(
      db,
      `SELECT p.*, c.name as customer_name
       FROM prescriptions p
       LEFT JOIN customers c ON c.id = p.customer_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return json({ prescriptions, total, page, limit, totalPages: Math.ceil(total / limit) });
  }

  if (method === 'GET' && segment) {
    const id = parseInt(segment);
    if (isNaN(id)) {
      return json({ error: 'Invalid ID' }, 400);
    }

    const prescription = await first(
      db,
      `SELECT p.*, c.name as customer_name
       FROM prescriptions p
       LEFT JOIN customers c ON c.id = p.customer_id
       WHERE p.id = ?`,
      [id]
    );
    if (!prescription) {
      return json({ error: 'Prescription not found' }, 404);
    }

    const items = await all(
      db,
      `SELECT pi.*, m.brand_name
       FROM prescription_items pi
       JOIN medicines m ON m.id = pi.medicine_id
       WHERE pi.prescription_id = ?`,
      [id]
    );

    return json({ ...prescription, items });
  }

  if (method === 'POST' && !segment) {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const { customer_id, doctor_name, doctor_license, hospital, diagnosis, notes, image, items } = body;

    const now = new Date().toISOString();
    const info = await run(
      db,
      `INSERT INTO prescriptions (customer_id, doctor_name, doctor_license, hospital, prescription_date, diagnosis, notes, image, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        customer_id || null, doctor_name || null, doctor_license || null,
        hospital || null, now.split('T')[0], diagnosis || null,
        notes || null, image || null, now
      ]
    );

    const prescriptionId = info.lastInsertRowid;

    if (items && Array.isArray(items)) {
      for (const item of items) {
        await run(
          db,
          `INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, duration, quantity_prescribed, quantity_dispensed, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            prescriptionId, item.medicine_id,
            item.dosage || null, item.frequency || null, item.duration || null,
            item.quantity_prescribed || 0, item.quantity_dispensed || 0,
            item.notes || null
          ]
        );
      }
    }

    const prescription = await first(db, 'SELECT * FROM prescriptions WHERE id = ?', [prescriptionId]);
    const prescriptionItems = await all(
      db,
      `SELECT pi.*, m.brand_name
       FROM prescription_items pi
       JOIN medicines m ON m.id = pi.medicine_id
       WHERE pi.prescription_id = ?`,
      [prescriptionId]
    );

    return json({ ...prescription, items: prescriptionItems }, 201);
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

    const existing = await first(db, 'SELECT id FROM prescriptions WHERE id = ?', [id]);
    if (!existing) {
      return json({ error: 'Prescription not found' }, 404);
    }

    const body = await request.json().catch(() => ({}));
    const { customer_id, doctor_name, doctor_license, hospital, diagnosis, notes, image, status, items } = body;

    await run(
      db,
      `UPDATE prescriptions SET
        customer_id = COALESCE(?, customer_id),
        doctor_name = COALESCE(?, doctor_name),
        doctor_license = COALESCE(?, doctor_license),
        hospital = COALESCE(?, hospital),
        diagnosis = COALESCE(?, diagnosis),
        notes = COALESCE(?, notes),
        image = COALESCE(?, image),
        status = COALESCE(?, status)
       WHERE id = ?`,
      [customer_id, doctor_name, doctor_license, hospital, diagnosis, notes, image, status, id]
    );

    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (item.id) {
          await run(
            db,
            `UPDATE prescription_items SET
              dosage = COALESCE(?, dosage),
              frequency = COALESCE(?, frequency),
              duration = COALESCE(?, duration),
              quantity_prescribed = COALESCE(?, quantity_prescribed),
              quantity_dispensed = COALESCE(?, quantity_dispensed),
              notes = COALESCE(?, notes)
             WHERE id = ? AND prescription_id = ?`,
            [item.dosage, item.frequency, item.duration, item.quantity_prescribed, item.quantity_dispensed, item.notes, item.id, id]
          );
        } else {
          await run(
            db,
            `INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, duration, quantity_prescribed, quantity_dispensed, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, item.medicine_id, item.dosage || null, item.frequency || null, item.duration || null, item.quantity_prescribed || 0, item.quantity_dispensed || 0, item.notes || null]
          );
        }
      }
    }

    const prescription = await first(db, 'SELECT * FROM prescriptions WHERE id = ?', [id]);
    const prescriptionItems = await all(db, 'SELECT * FROM prescription_items WHERE prescription_id = ?', [id]);
    return json({ ...prescription, items: prescriptionItems });
  }

  return json({ error: 'Not found' }, 404);
}
