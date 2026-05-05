const express = require('express');
const https   = require('https');
const crypto  = require('crypto');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ADMIN_USER            = process.env.ADMIN_USER || 'WOOD FRAME';
const ADMIN_PASS            = process.env.ADMIN_PASS || 'WOOD FRAME';
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY    = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// ── FIREBASE ADMIN ──
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

initializeApp({
  credential: cert({
    projectId:   process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

// ── AUTH ──
function isAdmin(req) {
  return req.headers['x-admin-token'] === Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');
}

// ── ORDERS ──
app.post('/api/orders', async (req, res) => {
  const { nombre, telefono, correo, producto, precio, notas } = req.body;
  if (!nombre || !producto) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const order = {
      fecha: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
      nombre, telefono: telefono||'', correo: correo||'',
      producto, precio: precio||'', notas: notas||'',
      estado: 'Pendiente',
      createdAt: Date.now(),
    };
    const ref = await db.collection('orders').add(order);
    res.json({ ok: true, order: { id: ref.id, ...order } });
  } catch(e) {
    res.status(500).json({ error: 'Error al guardar pedido' });
  }
});

app.get('/api/orders', async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
  try {
    const snap = await db.collection('orders').orderBy('createdAt','desc').get();
    const orders = [];
    snap.forEach(d => orders.push({ id: d.id, ...d.data() }));
    res.json(orders);
  } catch(e) {
    res.status(500).json({ error: 'Error al cargar pedidos' });
  }
});

app.patch('/api/orders/:id', async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
  try {
    await db.collection('orders').doc(req.params.id).update({ estado: req.body.estado });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
  try {
    await db.collection('orders').doc(req.params.id).delete();
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// ── LOGIN ──
app.post('/api/login', (req, res) => {
  const { user, pass } = req.body;
  if (user === ADMIN_USER && pass === ADMIN_PASS)
    return res.json({ ok: true, token: Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64') });
  res.status(401).json({ error: 'Credenciales incorrectas' });
});

// ── CLOUDINARY ──
app.get('/api/cloudinary-config', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
  res.json({ cloudName: CLOUDINARY_CLOUD_NAME });
});

app.post('/api/upload-signature', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
  const timestamp = Math.round(Date.now() / 1000);
  const signature = crypto.createHash('sha1').update(`timestamp=${timestamp}${CLOUDINARY_API_SECRET}`).digest('hex');
  res.json({ signature, timestamp, cloudName: CLOUDINARY_CLOUD_NAME, apiKey: CLOUDINARY_API_KEY });
});

// ── FIREBASE CONFIG PUBLICA ──
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
app.get('/ping', (req, res) => res.send('ok'));
app.listen(PORT, () => console.log(`Wood Frame server running on port ${PORT}`));