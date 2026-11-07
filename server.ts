import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleApiRequest } from './server/apiHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// Handle API requests
app.all('/api/*', async (req, res) => {
  await handleApiRequest(req, res);
});

// Serve static assets in production
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const portNumber = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
app.listen(portNumber, '0.0.0.0', () => {
  console.log(`Hauzral Pharmacy POS running on http://0.0.0.0:${portNumber}`);
});
