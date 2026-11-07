import { first, all, run, json, authenticate } from '../utils/d1.js';

export async function settingsRoutes(request, env, path, db) {
  const parts = path.split('/').filter(Boolean);
  const method = request.method;
  const segment = parts[0] || '';
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  if (method === 'GET' && segment === 'audit-logs') {
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = (page - 1) * limit;
    const userId = searchParams.get('user_id');

    let where = 'WHERE 1=1';
    const params = [];

    if (userId) {
      where += ' AND al.user_id = ?';
      params.push(parseInt(userId));
    }

    const countRow = await first(db, `SELECT COUNT(*) as total FROM audit_logs al ${where}`, params);
    const total = countRow ? countRow.total : 0;

    const logs = await all(
      db,
      `SELECT al.*, u.full_name as user_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return json({ logs, total, page, limit, totalPages: Math.ceil(total / limit) });
  }

  if (method === 'GET' && segment === 'branches') {
    const branches = await all(db, 'SELECT * FROM branches ORDER BY name');
    return json(branches);
  }

  if (method === 'POST' && segment === 'branches') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (authUser.role !== 'admin' && authUser.role !== 'manager') {
      return json({ error: 'Insufficient permissions' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const { name, address, phone, manager_id } = body;

    if (!name) {
      return json({ error: 'Branch name is required' }, 400);
    }

    const now = new Date().toISOString();
    const info = await run(
      db,
      'INSERT INTO branches (name, address, phone, manager_id, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
      [name, address || null, phone || null, manager_id || null, now]
    );

    const branch = await first(db, 'SELECT * FROM branches WHERE id = ?', [info.lastInsertRowid]);
    return json(branch, 201);
  }

  if (method === 'GET' && segment === 'insurance') {
    const providers = await all(db, 'SELECT * FROM insurance_providers ORDER BY name');
    return json(providers);
  }

  if (method === 'POST' && segment === 'insurance') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (authUser.role !== 'admin' && authUser.role !== 'manager') {
      return json({ error: 'Insufficient permissions' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const { name, contact_person, phone, email, claim_percentage } = body;

    if (!name) {
      return json({ error: 'Insurance provider name is required' }, 400);
    }

    const now = new Date().toISOString();
    const info = await run(
      db,
      'INSERT INTO insurance_providers (name, contact_person, phone, email, claim_percentage, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
      [name, contact_person || null, phone || null, email || null, claim_percentage || 0, now]
    );

    const provider = await first(db, 'SELECT * FROM insurance_providers WHERE id = ?', [info.lastInsertRowid]);
    return json(provider, 201);
  }

  if (method === 'GET' && !segment) {
    const settings = await all(db, 'SELECT * FROM settings ORDER BY key');
    const settingsObj = {};
    for (const setting of settings) {
      settingsObj[setting.key] = { value: setting.value, category: setting.category };
    }
    return json(settingsObj);
  }

  if (method === 'PUT' && !segment) {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (authUser.role !== 'admin' && authUser.role !== 'manager') {
      return json({ error: 'Insufficient permissions' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    if (!body || Object.keys(body).length === 0) {
      return json({ error: 'Settings object is required' }, 400);
    }

    const now = new Date().toISOString();

    for (const [key, val] of Object.entries(body)) {
      const value = typeof val === 'object' ? JSON.stringify(val) : String(val);
      const category = typeof val === 'object' && val.category ? val.category : null;

      const existing = await first(db, 'SELECT id FROM settings WHERE key = ?', [key]);
      if (existing) {
        await run(db, 'UPDATE settings SET value = ?, updated_at = ? WHERE key = ?', [value, now, key]);
      } else {
        await run(db, 'INSERT INTO settings (key, value, category, updated_at) VALUES (?, ?, ?, ?)', [key, value, category, now]);
      }

      await run(
        db,
        'INSERT INTO audit_logs (user_id, action, entity, entity_id, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [authUser.id, 'settings_update', 'setting', key, value, null, now]
      );
    }

    const settings = await all(db, 'SELECT * FROM settings ORDER BY key');
    const settingsObj = {};
    for (const setting of settings) {
      settingsObj[setting.key] = { value: setting.value, category: setting.category };
    }
    return json(settingsObj);
  }

  return json({ error: 'Not found' }, 404);
}
