import { initializeDatabase } from './database/schema.js';
import { json, cors } from './utils/d1.js';
import { authRoutes } from './routes/auth.js';
import { medicineRoutes } from './routes/medicines.js';
import { inventoryRoutes } from './routes/inventory.js';
import { posRoutes } from './routes/pos.js';
import { customerRoutes } from './routes/customers.js';
import { supplierRoutes } from './routes/suppliers.js';
import { prescriptionRoutes } from './routes/prescriptions.js';
import { reportRoutes } from './routes/reports.js';
import { aiRoutes } from './routes/ai.js';
import { notificationRoutes } from './routes/notifications.js';
import { settingsRoutes } from './routes/settings.js';
import { employeeRoutes } from './routes/employees.js';

let dbInitialized = false;

async function ensureDbInitialized(db) {
  if (!dbInitialized) {
    await initializeDatabase(db);
    dbInitialized = true;
  }
}

const routeMap = {
  auth: authRoutes,
  medicines: medicineRoutes,
  inventory: inventoryRoutes,
  pos: posRoutes,
  customers: customerRoutes,
  suppliers: supplierRoutes,
  prescriptions: prescriptionRoutes,
  reports: reportRoutes,
  ai: aiRoutes,
  notifications: notificationRoutes,
  settings: settingsRoutes,
  employees: employeeRoutes,
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return cors();
    }

    const url = new URL(request.url);
    const fullPath = url.pathname;

    if (fullPath === '/api/health') {
      return json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    if (!fullPath.startsWith('/api/')) {
      if (env.ASSETS) {
        let assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status === 404) {
          const indexRequest = new URL(request.url);
          indexRequest.pathname = '/index.html';
          assetResponse = await env.ASSETS.fetch(new Request(indexRequest.toString(), request));
        }
        return assetResponse;
      }
      return json({ error: 'Not found' }, 404);
    }

    const db = env.DB;
    await ensureDbInitialized(db);

    const afterApi = fullPath.slice(5);
    const parts = afterApi.split('/').filter(Boolean);
    const routeKey = parts[0];

    if (!routeMap[routeKey]) {
      return json({ error: 'Not found' }, 404);
    }

    const subPath = '/' + parts.slice(1).join('/');

    try {
      return await routeMap[routeKey](request, env, subPath, db);
    } catch (error) {
      console.error(`Error in ${routeKey} route:`, error);
      return json({ error: error.message || 'Internal server error' }, 500);
    }
  },
};
