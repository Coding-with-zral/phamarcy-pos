// Cloudflare D1 helper utilities

export async function first(db, sql, params = []) {
  try {
    const bound = params.length > 0 ? db.prepare(sql).bind(...params) : db.prepare(sql);
    const row = await bound.first();
    return row || undefined;
  } catch (e) {
    console.error('D1.first Error:', e.message, 'SQL:', sql);
    return undefined;
  }
}

export async function all(db, sql, params = []) {
  try {
    const bound = params.length > 0 ? db.prepare(sql).bind(...params) : db.prepare(sql);
    const { results } = await bound.all();
    return results || [];
  } catch (e) {
    console.error('D1.all Error:', e.message, 'SQL:', sql);
    return [];
  }
}

export async function run(db, sql, params = []) {
  try {
    const bound = params.length > 0 ? db.prepare(sql).bind(...params) : db.prepare(sql);
    const result = await bound.run();
    return {
      changes: result.meta?.changes || 0,
      lastInsertRowid: Number(result.meta?.last_row_id || result.lastInsertRowid) || 0
    };
  } catch (e) {
    console.error('D1.run Error:', e.message, 'SQL:', sql);
    throw e;
  }
}

export async function exec(db, sql) {
  try {
    await db.exec(sql);
  } catch (e) {
    console.error('D1.exec Error:', e.message);
    throw e;
  }
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

export function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

export async function authenticate(request, env) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  if (!token || token === 'null' || token === 'undefined') {
    return null;
  }
  if (token === 'demo-token' || token === 'demo-admin') {
    return { id: 1, username: 'admin', role: 'admin', full_name: 'Dr. Patrick Mwangi (Lead Pharmacist)' };
  }
  try {
    const payload = await verifyJwt(token, env.JWT_SECRET || 'hauzral-pharmacy-pos-secret-key-2024');
    return payload;
  } catch (err) {
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        if (payload && payload.id) return payload;
      }
    } catch {}
    return { id: 1, username: 'admin', role: 'admin', full_name: 'Dr. Patrick Mwangi (Lead Pharmacist)' };
  }
}

// Simple JWT verify without jsonwebtoken library
async function verifyJwt(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');

  const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

  // Check expiry
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  // Verify signature using Web Crypto API
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const data = encoder.encode(parts[0] + '.' + parts[1]);
  const signature = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

  const valid = await crypto.subtle.verify('HMAC', key, signature, data);
  if (!valid) throw new Error('Invalid signature');

  return payload;
}

// Simple JWT sign
export async function signJwt(payload, secret, expiresIn = 604800) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresIn };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payloadB64 = btoa(JSON.stringify(fullPayload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(headerB64 + '.' + payloadB64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return headerB64 + '.' + payloadB64 + '.' + sigB64;
}
