const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ORDERS_FILE = path.join(__dirname, 'orders.json');
const ADMIN_USER  = process.env.ADMIN_USER || 'WOOD FRAME';
const ADMIN_PASS  = process.env.ADMIN_PASS || 'WOOD FRAME';

const CLOUDINARY_CLOUD_NAME    = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY       = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET    = process.env.CLOUDINARY_API_SECRET;
const CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET;

// ── AUTH ──
function isAdmin(req) {
  const token = req.headers['x-admin-token'];
  return token === Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');
}

// ── ORDERS ──
function loadOrders() {
  if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');
  return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
}
function saveOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

app.post('/api/orders', (req, res) => {
  const { nombre, telefono, correo, producto, precio, notas } = req.body;
  if (!nombre || !producto) return res.status(400).json({ error: 'Faltan datos' });
  const orders = loadOrders();
  const order = {
    id: Date.now(),
    fecha: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
    nombre, telefono, correo, producto, precio, notas,
    estado: 'Pendiente'
  };
  orders.push(order);
  saveOrders(orders);
  res.json({ ok: true, order });
});

app.get('/api/orders', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
  res.json(loadOrders());
});

app.patch('/api/orders/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
  const orders = loadOrders();
  const idx = orders.findIndex(o => o.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  orders[idx].estado = req.body.estado || orders[idx].estado;
  saveOrders(orders);
  res.json(orders[idx]);
});

app.delete('/api/orders/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
  let orders = loadOrders();
  orders = orders.filter(o => o.id !== parseInt(req.params.id));
  saveOrders(orders);
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { user, pass } = req.body;
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    return res.json({ ok: true, token: Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64') });
  }
  res.status(401).json({ error: 'Credenciales incorrectas' });
});

// ── CLOUDINARY UPLOAD (firma desde servidor, sube desde cliente) ──
// El cliente sube directamente a Cloudinary usando un preset unsigned.
// Si prefieres upload firmado, este endpoint genera la firma.
app.post('/api/upload-signature', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
  const timestamp = Math.round(Date.now() / 1000);
  const crypto = require('crypto');
  const str = `timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash('sha1').update(str).digest('hex');
  res.json({
    signature,
    timestamp,
    cloudName: CLOUDINARY_CLOUD_NAME,
    apiKey: CLOUDINARY_API_KEY,
  });
});

// ── FIREBASE CONFIG (expone solo las claves públicas al frontend) ──
app.get('/api/firebase-config', (req, res) => {
  res.json({
    apiKey:            process.env.FIREBASE_API_KEY,
    authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.FIREBASE_PROJECT_ID,
    storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.FIREBASE_APP_ID,
  });
});

app.listen(PORT, () => console.log(`Wood Frame server running on port ${PORT}`));