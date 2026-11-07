import bcrypt from 'bcryptjs';
import { first, all, run, json, authenticate } from '../utils/d1.js';

export async function employeeRoutes(request, env, path, db) {
  const parts = path.split('/').filter(Boolean);
  const method = request.method;
  const segment = parts[0] || '';
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  if (method === 'GET' && segment === 'performance') {
    const startDate = searchParams.get('start_date') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || startDate;

    const performance = await all(
      db,
      `SELECT u.id, u.full_name, u.role,
              COUNT(s.id) as sales_count,
              COALESCE(SUM(s.total_amount), 0) as total_revenue,
              COALESCE(AVG(s.total_amount), 0) as avg_sale_value,
              COALESCE(SUM(si.quantity), 0) as items_sold
       FROM users u
       LEFT JOIN sales s ON s.user_id = u.id AND s.status = 'completed' AND DATE(s.created_at) BETWEEN ? AND ?
       LEFT JOIN sale_items si ON si.sale_id = s.id
       WHERE u.is_active = 1
       GROUP BY u.id
       ORDER BY total_revenue DESC`,
      [startDate, endDate]
    );

    return json({ performance, start_date: startDate, end_date: endDate });
  }

  if (method === 'GET' && segment === 'activity-log') {
    const userId = searchParams.get('user_id');
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = (page - 1) * limit;

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

  if (method === 'GET' && !segment) {
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';

    let where = 'WHERE u.is_active = 1';
    const params = [];

    if (search) {
      where += ' AND (u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (role) {
      where += ' AND u.role = ?';
      params.push(role);
    }

    const employees = await all(
      db,
      `SELECT u.id, u.username, u.full_name, u.role, u.email, u.phone, u.avatar, u.is_active, u.created_at,
              (SELECT COUNT(*) FROM sales s WHERE s.user_id = u.id AND s.status = 'completed') as total_sales,
              (SELECT COALESCE(SUM(s.total_amount), 0) FROM sales s WHERE s.user_id = u.id AND s.status = 'completed') as total_revenue
       FROM users u
       ${where}
       ORDER BY u.full_name`,
      params
    );

    return json(employees);
  }

  if (method === 'POST' && !segment) {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (authUser.role !== 'admin' && authUser.role !== 'manager') {
      return json({ error: 'Insufficient permissions' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const { username, password: rawPassword, full_name, role, email, phone } = body;

    if (!username || !rawPassword || !full_name) {
      return json({ error: 'username, password, and full_name are required' }, 400);
    }

    const existing = await first(db, 'SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return json({ error: 'Username already exists' }, 409);
    }

    const hashedPassword = bcrypt.hashSync(rawPassword, 10);
    const now = new Date().toISOString();

    const info = await run(
      db,
      'INSERT INTO users (username, password, full_name, role, email, phone, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
      [username, hashedPassword, full_name, role || 'cashier', email || null, phone || null, now]
    );

    const employee = await first(
      db,
      'SELECT id, username, full_name, role, email, phone, is_active, created_at FROM users WHERE id = ?',
      [info.lastInsertRowid]
    );

    return json(employee, 201);
  }

  if (method === 'PUT' && segment) {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (authUser.role !== 'admin' && authUser.role !== 'manager') {
      return json({ error: 'Insufficient permissions' }, 403);
    }

    const id = parseInt(segment);
    if (isNaN(id)) {
      return json({ error: 'Invalid ID' }, 400);
    }

    const existing = await first(db, 'SELECT id FROM users WHERE id = ?', [id]);
    if (!existing) {
      return json({ error: 'Employee not found' }, 404);
    }

    const body = await request.json().catch(() => ({}));
    const { full_name, role, email, phone, is_active } = body;

    const now = new Date().toISOString();
    await run(
      db,
      `UPDATE users SET
        full_name = COALESCE(?, full_name),
        role = COALESCE(?, role),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        is_active = COALESCE(?, is_active),
        updated_at = ?
       WHERE id = ?`,
      [full_name, role, email, phone, is_active !== undefined ? (is_active ? 1 : 0) : null, now, id]
    );

    const employee = await first(
      db,
      'SELECT id, username, full_name, role, email, phone, avatar, is_active, created_at FROM users WHERE id = ?',
      [id]
    );

    return json(employee);
  }

  if (method === 'DELETE' && segment) {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (authUser.role !== 'admin' && authUser.role !== 'manager') {
      return json({ error: 'Insufficient permissions' }, 403);
    }

    const id = parseInt(segment);
    if (isNaN(id)) {
      return json({ error: 'Invalid ID' }, 400);
    }

    const existing = await first(db, 'SELECT id FROM users WHERE id = ?', [id]);
    if (!existing) {
      return json({ error: 'Employee not found' }, 404);
    }

    if (id === authUser.id) {
      return json({ error: 'Cannot deactivate yourself' }, 400);
    }

    const now = new Date().toISOString();
    await run(db, 'UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?', [now, id]);
    return json({ message: 'Employee deactivated' });
  }

  return json({ error: 'Not found' }, 404);
}
