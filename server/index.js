import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import db from './database/connection.js';
import { initializeDatabase } from './database/schema.js';
import authRoutes from './routes/auth.js';
import medicineRoutes from './routes/medicines.js';
import inventoryRoutes from './routes/inventory.js';
import posRoutes from './routes/pos.js';
import customerRoutes from './routes/customers.js';
import supplierRoutes from './routes/suppliers.js';
import prescriptionRoutes from './routes/prescriptions.js';
import reportRoutes from './routes/reports.js';
import aiRoutes from './routes/ai.js';
import notificationRoutes from './routes/notifications.js';
import settingsRoutes from './routes/settings.js';
import employeeRoutes from './routes/employees.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/employees', employeeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', name: 'Hauzral Pharmacy POS' });
});

// Initialize DB and start server
async function start() {
  try {
    await db.initConnection();
    console.log('Database connected');
    await initializeDatabase();
    console.log('Database schema initialized');
    app.listen(PORT, () => {
      console.log(`Hauzral Pharmacy POS Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
