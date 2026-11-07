// Cloudflare D1 database wrapper
// Provides a compatible API for routes that previously used sql.js

let dbBinding = null;

export function setDb(env) {
  dbBinding = env.DB || env.DATABASE;
}

export function getDb() {
  return dbBinding;
}

export function createDb(env) {
  const d1 = env.DB || env.DATABASE;

  function prepare(sql) {
    const stmt = d1.prepare(sql);

    return {
      async get(...params) {
        try {
          const bound = params.length > 0 ? stmt.bind(...params) : stmt;
          const row = await bound.first();
          return row || undefined;
        } catch (e) {
          console.error('D1 Get Error:', e.message, 'SQL:', sql);
          return undefined;
        }
      },

      async all(...params) {
        try {
          const bound = params.length > 0 ? stmt.bind(...params) : stmt;
          const result = await bound.all();
          return result.results || [];
        } catch (e) {
          console.error('D1 All Error:', e.message, 'SQL:', sql);
          return [];
        }
      },

      async run(...params) {
        try {
          const bound = params.length > 0 ? stmt.bind(...params) : stmt;
          const result = await bound.run();
          return {
            changes: result.meta?.changes || 0,
            lastInsertRowid: result.meta?.last_row_id || 0
          };
        } catch (e) {
          console.error('D1 Run Error:', e.message, 'SQL:', sql);
          throw e;
        }
      }
    };
  }

  async function exec(sql) {
    try {
      await d1.exec(sql);
    } catch (e) {
      console.error('D1 Exec Error:', e.message);
      throw e;
    }
  }

  return { prepare, exec };
}
