import bcrypt from 'bcryptjs';
import { first, all, run, json, authenticate, signJwt } from '../utils/d1.js';

export async function authRoutes(request, env, path, db) {
  const parts = path.split('/').filter(Boolean);
  const method = request.method;
  const segment = parts[0] || '';

  if (method === 'POST' && segment === 'login') {
    const body = await request.json().catch(() => ({}));
    const { username, password } = body;

    if (!username || !password) {
      return json({ error: 'Username and password are required' }, 400);
    }

    const user = await first(db, 'SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);
    if (!user) {
      return json({ error: 'Invalid credentials' }, 401);
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return json({ error: 'Invalid credentials' }, 401);
    }

    const now = new Date().toISOString();
    await run(db, 'UPDATE users SET last_login = ? WHERE id = ?', [now, user.id]);
    user.last_login = now;

    const token = await signJwt(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      env.JWT_SECRET || 'hauzral-pharmacy-pos-secret-key-2024',
      604800
    );

    const { password: _pw, ...safeUser } = user;
    return json({ token, user: safeUser });
  }

  if (method === 'POST' && segment === 'forgot-password') {
    const body = await request.json().catch(() => ({}));
    const { identifier } = body;

    if (!identifier) {
      return json({ error: 'Please enter your username or registered email' }, 400);
    }

    const cleanId = identifier.trim();
    const user = await first(
      db,
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1',
      [cleanId, cleanId]
    );

    if (!user) {
      return json({ error: 'No active staff account found with this username or email' }, 404);
    }

    const resetPin = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await run(
      db,
      'UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?',
      [resetPin, expiresAt, user.id]
    );

    await run(
      db,
      `INSERT INTO notifications (user_id, type, title, message, is_read, priority, created_at)
       VALUES (?, 'security', 'Password Reset Requested', ?, 0, 'high', ?)`,
      [user.id, `Password recovery code ${resetPin} generated for user ${user.username}`, new Date().toISOString()]
    );

    const emailMasked = user.email
      ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
      : `${user.username.slice(0, 2)}*** (internal)`;

    return json({
      success: true,
      message: `Password reset verification code generated for ${user.full_name}`,
      reset_pin: resetPin,
      email_masked: emailMasked,
      username: user.username,
    });
  }

  if (method === 'POST' && segment === 'reset-password') {
    const body = await request.json().catch(() => ({}));
    const { identifier, pin, new_password } = body;

    if (!identifier || !pin || !new_password) {
      return json({ error: 'Username/email, reset code, and new password are required' }, 400);
    }

    if (new_password.length < 6) {
      return json({ error: 'Password must be at least 6 characters long' }, 400);
    }

    const cleanId = identifier.trim();
    const cleanPin = pin.trim();

    const user = await first(
      db,
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1',
      [cleanId, cleanId]
    );

    if (!user) {
      return json({ error: 'User account not found' }, 404);
    }

    if (!user.reset_token || user.reset_token !== cleanPin) {
      return json({ error: 'Invalid or expired password reset verification code' }, 400);
    }

    if (user.reset_expires && new Date(user.reset_expires).getTime() < Date.now()) {
      return json({ error: 'Password reset code has expired. Please request a new one.' }, 400);
    }

    const hashedPassword = bcrypt.hashSync(new_password, 10);
    const now = new Date().toISOString();

    await run(
      db,
      'UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL, updated_at = ? WHERE id = ?',
      [hashedPassword, now, user.id]
    );

    await run(
      db,
      `INSERT INTO notifications (user_id, type, title, message, is_read, priority, created_at)
       VALUES (?, 'security', 'Password Updated', 'Your pharmacy account password was successfully reset.', 0, 'normal', ?)`,
      [user.id, now]
    );

    return json({
      success: true,
      message: 'Password reset successfully! You can now sign in with your new password.',
    });
  }

  if (method === 'POST' && segment === 'unlock') {
    const body = await request.json().catch(() => ({}));
    const { user_id, password, pin } = body;

    if (!user_id || (!password && !pin)) {
      return json({ error: 'User ID and password or PIN required' }, 400);
    }

    const user = await first(db, 'SELECT * FROM users WHERE id = ? AND is_active = 1', [user_id]);
    if (!user) {
      return json({ error: 'User not found' }, 404);
    }

    let isValid = false;
    if (pin && user.pin && user.pin === pin.trim()) {
      isValid = true;
    } else if (password) {
      isValid = bcrypt.compareSync(password, user.password);
    }

    if (!isValid) {
      return json({ error: 'Incorrect station password or PIN' }, 401);
    }

    const now = new Date().toISOString();
    await run(db, 'UPDATE users SET last_login = ? WHERE id = ?', [now, user.id]);
    user.last_login = now;

    const token = await signJwt(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      env.JWT_SECRET || 'hauzral-pharmacy-pos-secret-key-2024',
      604800
    );

    const { password: _pw, ...safeUser } = user;
    return json({ success: true, token, user: safeUser });
  }

  if (method === 'POST' && segment === 'set-pin') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const { pin } = body;

    if (!pin || pin.length < 4) {
      return json({ error: 'PIN must be at least 4 digits' }, 400);
    }

    await run(db, 'UPDATE users SET pin = ?, updated_at = ? WHERE id = ?', [pin.trim(), new Date().toISOString(), authUser.id]);
    return json({ success: true, message: 'Quick Unlock PIN updated successfully' });
  }

  if (method === 'POST' && segment === 'google') {
    const body = await request.json().catch(() => ({}));
    let { email, name, picture, credential, role = 'pharmacist' } = body;

    if (credential && typeof credential === 'string') {
      try {
        const parts = credential.split('.');
        if (parts.length >= 2) {
          const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
          const payload = JSON.parse(payloadStr);
          if (payload.email) {
            email = payload.email;
            name = payload.name || name;
            picture = payload.picture || picture;
          }
        }
      } catch (e) {
        console.warn('Could not decode Google credential token:', e);
      }
    }

    if (!email) {
      return json({ error: 'Valid Google email is required' }, 400);
    }

    let user = await first(db, 'SELECT * FROM users WHERE email = ?', [email]);
    const now = new Date().toISOString();

    if (!user) {
      const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') + '_' + Math.floor(Math.random() * 900 + 100);
      const randomPassword = bcrypt.hashSync(Math.random().toString(36) + 'Hauzral@2026', 10);
      const fullName = name || email.split('@')[0];

      const res = await run(
        db,
        'INSERT INTO users (username, password, full_name, role, email, avatar, is_active, last_login, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
        [username, randomPassword, fullName, role, email, picture || null, now, now]
      );

      user = await first(db, 'SELECT * FROM users WHERE id = ?', [res.lastInsertRowid]);
    } else {
      if (!user.is_active) {
        return json({ error: 'Your pharmacy account has been deactivated. Please contact the administrator.' }, 403);
      }
      await run(db, 'UPDATE users SET avatar = COALESCE(?, avatar), last_login = ?, updated_at = ? WHERE id = ?', [picture || null, now, now, user.id]);
      user.last_login = now;
      if (picture && !user.avatar) {
        user.avatar = picture;
      }
    }

    const token = await signJwt(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      env.JWT_SECRET || 'hauzral-pharmacy-pos-secret-key-2024',
      604800
    );

    const { password: _pw, ...safeUser } = user;
    return json({ token, user: safeUser });
  }

  if (method === 'POST' && segment === 'register') {
    const authUser = await authenticate(request, env);
    const body = await request.json().catch(() => ({}));
    const { username, password: rawPassword, full_name, role, email, phone } = body;

    if (!username || !rawPassword || !full_name) {
      return json({ error: 'Username, password, and full_name are required' }, 400);
    }

    if (rawPassword.length < 6) {
      return json({ error: 'Password must be at least 6 characters' }, 400);
    }

    const existingUserCount = await first(db, 'SELECT COUNT(*) as total FROM users');
    const noUsersExist = !existingUserCount || Number(existingUserCount.total) === 0;

    if (!authUser) {
      if (!noUsersExist) {
        const existingAdmin = await first(db, "SELECT id FROM users WHERE role = 'admin' LIMIT 1");
        if (existingAdmin) {
          return json({ error: 'Registration requires admin authorization' }, 403);
        }
      }
    } else if (authUser.role !== 'admin' && authUser.role !== 'manager') {
      return json({ error: 'Insufficient permissions' }, 403);
    }

    const existing = await first(db, 'SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return json({ error: 'Username already exists' }, 409);
    }

    const hashedPassword = bcrypt.hashSync(rawPassword, 10);
    const now = new Date().toISOString();
    const assignedRole = authUser ? (role || 'cashier') : 'admin';

    const info = await run(
      db,
      'INSERT INTO users (username, password, full_name, role, email, phone, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
      [username, hashedPassword, full_name, assignedRole, email || null, phone || null, now]
    );

    const token = await signJwt(
      { id: info.lastInsertRowid, username, role: assignedRole, full_name },
      env.JWT_SECRET || 'hauzral-pharmacy-pos-secret-key-2024',
      604800
    );

    const newUser = { id: info.lastInsertRowid, username, full_name, role: assignedRole, email: email || null, phone: phone || null, is_active: 1, created_at: now };
    return json({ token, user: newUser }, 201);
  }

  if (method === 'GET' && segment === 'me') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const user = await first(
      db,
      'SELECT id, username, full_name, role, email, phone, avatar, is_active, two_factor_enabled, created_at FROM users WHERE id = ?',
      [authUser.id]
    );
    if (!user) {
      return json({ error: 'User not found' }, 404);
    }
    return json(user);
  }

  if (method === 'GET' && segment === 'users') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const users = await all(db, 'SELECT id, username, full_name, role, email, phone, avatar, is_active, two_factor_enabled, created_at FROM users ORDER BY created_at DESC');
    return json(users);
  }

  if (method === 'PUT' && segment === 'users') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const id = parts[1] ? parseInt(parts[1]) : null;
    if (!id) {
      return json({ error: 'User ID is required' }, 400);
    }

    const body = await request.json().catch(() => ({}));
    const { full_name, role, email, phone, is_active, password: rawPassword, avatar } = body;

    const existing = await first(db, 'SELECT id FROM users WHERE id = ?', [id]);
    if (!existing) {
      return json({ error: 'User not found' }, 404);
    }

    const now = new Date().toISOString();

    if (rawPassword) {
      const hashedPassword = bcrypt.hashSync(rawPassword, 10);
      await run(db, `UPDATE users SET full_name = COALESCE(?, full_name), role = COALESCE(?, role), email = COALESCE(?, email), phone = COALESCE(?, phone), avatar = COALESCE(?, avatar), is_active = COALESCE(?, is_active), password = COALESCE(?, password), updated_at = ? WHERE id = ?`,
        [full_name, role, email, phone, avatar, is_active !== undefined ? (is_active ? 1 : 0) : null, hashedPassword, now, id]);
    } else {
      await run(db, `UPDATE users SET full_name = COALESCE(?, full_name), role = COALESCE(?, role), email = COALESCE(?, email), phone = COALESCE(?, phone), avatar = COALESCE(?, avatar), is_active = COALESCE(?, is_active), updated_at = ? WHERE id = ?`,
        [full_name, role, email, phone, avatar, is_active !== undefined ? (is_active ? 1 : 0) : null, now, id]);
    }

    const updated = await first(db, 'SELECT id, username, full_name, role, email, phone, avatar, is_active, two_factor_enabled, created_at FROM users WHERE id = ?', [id]);
    return json(updated);
  }

  if (method === 'DELETE' && segment === 'users') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const id = parts[1] ? parseInt(parts[1]) : null;
    if (!id) {
      return json({ error: 'User ID is required' }, 400);
    }

    if (id === authUser.id) {
      return json({ error: 'Cannot deactivate yourself' }, 400);
    }

    const existing = await first(db, 'SELECT id FROM users WHERE id = ?', [id]);
    if (!existing) {
      return json({ error: 'User not found' }, 404);
    }

    await run(db, 'UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    return json({ message: 'User deactivated' });
  }

  return json({ error: 'Not found' }, 404);
}
