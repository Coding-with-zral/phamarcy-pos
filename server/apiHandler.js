import { setupDatabase, db } from './database/db.js';
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

let initialized = false;
async function ensureDb() {
  if (!initialized) {
    await setupDatabase();
    initialized = true;
  }
}

const routes = {
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

export async function handleApiRequest(req, res) {
  try {
    await ensureDb();

    // Health check
    if (req.url === '/api/health' || req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', name: 'Hauzral Pharmacy POS', version: '2.0.0' }));
      return;
    }

    // Parse URL path
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = parsedUrl.pathname;
    if (pathname.startsWith('/api/')) {
      pathname = pathname.substring(5);
    } else if (pathname.startsWith('/api')) {
      pathname = pathname.substring(4);
    }

    const segments = pathname.split('/').filter(Boolean);
    const prefix = segments[0];
    const subPath = '/' + segments.slice(1).join('/');

    if (!prefix || !routes[prefix]) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `API route not found: /api/${prefix}` }));
      return;
    }

    // Collect request body if needed
    let bodyBuffer = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body && typeof req.body === 'object') {
        bodyBuffer = Buffer.from(JSON.stringify(req.body));
      } else {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        if (chunks.length > 0) {
          bodyBuffer = Buffer.concat(chunks);
        }
      }
    }

    // Construct Web-standard Request
    const headers = new Headers();
    for (const [key, val] of Object.entries(req.headers)) {
      if (val !== undefined) {
        if (Array.isArray(val)) {
          val.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, String(val));
        }
      }
    }

    const webRequest = new Request(parsedUrl.href, {
      method: req.method,
      headers,
      body: bodyBuffer,
    });

    const env = {
      JWT_SECRET: process.env.JWT_SECRET || 'hauzral-pharmacy-pos-secret-key-2024',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    };

    const handler = routes[prefix];
    const webResponse = await handler(webRequest, env, subPath, db);

    // Write back response headers
    const status = webResponse.status || 200;
    const responseHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    webResponse.headers.forEach((val, key) => {
      responseHeaders[key] = val;
    });

    res.writeHead(status, responseHeaders);
    const responseText = await webResponse.text();
    res.end(responseText);
  } catch (err) {
    console.error('API Error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
    }
  }
}
