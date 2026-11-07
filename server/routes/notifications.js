import { first, all, run, json, authenticate } from '../utils/d1.js';

export async function notificationRoutes(request, env, path, db) {
  const parts = path.split('/').filter(Boolean);
  const method = request.method;
  const segment = parts[0] || '';
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  if (method === 'GET' && !segment) {
    const isRead = searchParams.get('is_read');
    const type = searchParams.get('type');
    const userId = searchParams.get('user_id');
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];

    if (userId) {
      where += ' AND n.user_id = ?';
      params.push(parseInt(userId));
    }
    if (isRead !== null && isRead !== undefined && isRead !== '') {
      where += ' AND n.is_read = ?';
      params.push(isRead === 'true' ? 1 : 0);
    }
    if (type) {
      where += ' AND n.type = ?';
      params.push(type);
    }

    const countRow = await first(db, `SELECT COUNT(*) as total FROM notifications n ${where}`, params);
    const total = countRow ? countRow.total : 0;

    const notifications = await all(
      db,
      `SELECT * FROM notifications n ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const unreadCount = await first(db, 'SELECT COUNT(*) as count FROM notifications WHERE is_read = 0');

    return json({ notifications, total, unread_count: unreadCount ? unreadCount.count : 0, page, limit, totalPages: Math.ceil(total / limit) });
  }

  if (method === 'POST' && !segment) {
    const body = await request.json().catch(() => ({}));
    const { user_id, type, title, message, priority } = body;

    if (!type || !title || !message) {
      return json({ error: 'type, title, and message are required' }, 400);
    }

    const now = new Date().toISOString();
    const info = await run(
      db,
      'INSERT INTO notifications (user_id, type, title, message, is_read, priority, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
      [user_id || null, type, title, message, priority || 'normal', now]
    );

    const notification = await first(db, 'SELECT * FROM notifications WHERE id = ?', [info.lastInsertRowid]);
    return json(notification, 201);
  }

  if (method === 'PUT' && segment === 'read-all') {
    await run(db, 'UPDATE notifications SET is_read = 1');
    return json({ message: 'All notifications marked as read' });
  }

  if (method === 'PUT' && segment && segment !== 'read-all') {
    const id = parseInt(segment);
    if (isNaN(id)) {
      return json({ error: 'Invalid ID' }, 400);
    }

    const existing = await first(db, 'SELECT id FROM notifications WHERE id = ?', [id]);
    if (!existing) {
      return json({ error: 'Notification not found' }, 404);
    }

    await run(db, 'UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    const notification = await first(db, 'SELECT * FROM notifications WHERE id = ?', [id]);
    return json(notification);
  }

  if (method === 'GET' && segment === 'check') {
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const notifications = [];

    const lowStock = await all(
      db,
      `SELECT m.id, m.brand_name, COALESCE(SUM(b.quantity), 0) as stock
       FROM medicines m
       LEFT JOIN batches b ON b.medicine_id = m.id AND b.quantity > 0
       WHERE m.is_active = 1
       GROUP BY m.id
       HAVING stock <= 10`
    );

    for (const item of lowStock) {
      const existing = await first(
        db,
        "SELECT id FROM notifications WHERE type = 'low_stock' AND message LIKE ? AND is_read = 0",
        [`%${item.brand_name}%`]
      );
      if (!existing) {
        await run(
          db,
          'INSERT INTO notifications (user_id, type, title, message, is_read, priority, created_at) VALUES (NULL, ?, ?, ?, 0, ?, ?)',
          ['low_stock', 'Low Stock Alert', `${item.brand_name} has only ${item.stock} units remaining`, 'high', new Date().toISOString()]
        );
        notifications.push({ type: 'low_stock', title: 'Low Stock Alert', message: `${item.brand_name} has only ${item.stock} units remaining` });
      }
    }

    const expiring = await all(
      db,
      `SELECT b.id, b.batch_number, b.expiry_date, m.brand_name
       FROM batches b
       JOIN medicines m ON m.id = b.medicine_id
       WHERE b.quantity > 0 AND b.expiry_date <= ? AND b.expiry_date >= ?`,
      [futureDateStr, today]
    );

    for (const batch of expiring) {
      const existing = await first(
        db,
        "SELECT id FROM notifications WHERE type = 'expiry' AND message LIKE ? AND is_read = 0",
        [`%${batch.batch_number}%`]
      );
      if (!existing) {
        await run(
          db,
          'INSERT INTO notifications (user_id, type, title, message, is_read, priority, created_at) VALUES (NULL, ?, ?, ?, 0, ?, ?)',
          ['expiry', 'Expiry Alert', `Batch ${batch.batch_number} of ${batch.brand_name} expires on ${batch.expiry_date}`, 'high', new Date().toISOString()]
        );
        notifications.push({ type: 'expiry', title: 'Expiry Alert', message: `Batch ${batch.batch_number} of ${batch.brand_name} expires on ${batch.expiry_date}` });
      }
    }

    return json({ new_notifications: notifications, checked_at: new Date().toISOString() });
  }

  return json({ error: 'Not found' }, 404);
}
