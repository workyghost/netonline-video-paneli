// mock-server/server.js
// Supabase API + Static file server — local test ortamı

const express = require('express');
const http    = require('http');
const crypto  = require('crypto');
const path    = require('path');
const WebSocket = require('ws');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server, path: '/realtime/v1/websocket' });

const PORT       = 3001;
const JWT_SECRET = 'local-test-secret-32chars-minimum!';

// b64u: base64url encode helper (JWT için)
const b64u = (str) => Buffer.from(str).toString('base64url');

// Anon key: geçerli JWT formatında (Supabase JS bunu decode etmeye çalışır)
const _ah = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const _ap = b64u(JSON.stringify({ role: 'anon', iss: 'supabase-local', iat: 1641769200, exp: 9999999999 }));
const ANON_KEY = `${_ah}.${_ap}.${crypto.createHmac('sha256', JWT_SECRET).update(`${_ah}.${_ap}`).digest('base64url')}`;

// ── CORS & JSON ──────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, Prefer, Range');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Range');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json());

// Tüm istekleri logla
app.use((req, res, next) => {
  console.log(`${new Date().toISOString().slice(11,19)} ${req.method} ${req.url}`);
  next();
});

// ── IN-MEMORY DB ─────────────────────────────────────────────────
const db = { firms: [], videos: [], screens: [], playlists: [] };

const users = [
  { id: 'admin-user-id', email: 'admin@test.com', password: 'admin123' }
];

// ── JWT helpers ──────────────────────────────────────────────────
function makeToken(userId, email) {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({
    sub: userId, email, role: 'authenticated', iss: 'supabase-local',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 * 24
  }));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}

function verifyToken(token) {
  try {
    const [h, p, sig] = (token || '').split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url');
    if (sig !== expected) return null;
    return JSON.parse(Buffer.from(p, 'base64url').toString());
  } catch { return null; }
}


function getAuth(req) {
  const auth = req.headers.authorization || '';
  return verifyToken(auth.replace('Bearer ', '').trim());
}

function uuid() { return crypto.randomUUID(); }

// ── AUTH ENDPOINTS ───────────────────────────────────────────────

// Login
app.post('/auth/v1/token', (req, res) => {
  const grantType = req.query.grant_type;

  if (grantType === 'refresh_token') {
    // Refresh: just return a new token for the existing user
    return res.json(makeSession(users[0]));
  }

  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid login credentials' });
  }
  res.json(makeSession(user));
});

function makeSession(user) {
  const token = makeToken(user.id, user.email);
  const expiresIn = 86400;
  return {
    access_token: token,
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    refresh_token: uuid(),
    user: buildUser(user)
  };
}

function buildUser(user) {
  return {
    id: user.id, email: user.email,
    role: 'authenticated',
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00.000Z',
    app_metadata: { provider: 'email' },
    user_metadata: {}
  };
}

// Get current user
app.get('/auth/v1/user', (req, res) => {
  const auth = getAuth(req);
  if (!auth) return res.status(401).json({ message: 'JWT expired or invalid' });
  const user = users.find(u => u.id === auth.sub);
  if (!user) return res.status(401).json({ message: 'User not found' });
  res.json(buildUser(user));
});

// Logout
app.post('/auth/v1/logout', (req, res) => res.status(204).send());

// Update user (password change)
app.put('/auth/v1/user', (req, res) => {
  const auth = getAuth(req);
  if (!auth) return res.status(401).json({ message: 'JWT expired or invalid' });
  const user = users.find(u => u.id === auth.sub);
  if (!user) return res.status(401).json({ message: 'User not found' });
  if (req.body.password) {
    user.password = req.body.password;
    console.log(`✅ Password updated for ${user.email}`);
  }
  res.json(buildUser(user));
});

// ── REST API (PostgREST compatible) ──────────────────────────────

function parseEqFilters(query) {
  const filters = {};
  for (const [key, val] of Object.entries(query)) {
    if (typeof val === 'string' && val.startsWith('eq.')) {
      filters[key] = val.slice(3);
    }
  }
  return filters;
}

function applyFilters(rows, filters) {
  return rows.filter(row =>
    Object.entries(filters).every(([k, v]) => String(row[k]) === String(v))
  );
}

// GET / HEAD
app.get('/rest/v1/:table', (req, res) => {
  const t = db[req.params.table];
  if (!t) return res.status(404).json({ message: 'relation does not exist' });

  const filters = parseEqFilters(req.query);
  let rows = applyFilters(t, filters);

  const select = req.query.select;
  if (select && select !== '*') {
    const fields = select.split(',').map(f => f.trim());
    rows = rows.map(row => Object.fromEntries(fields.map(f => [f, row[f]])));
  }

  res.setHeader('Content-Range', `0-${Math.max(0, rows.length - 1)}/${rows.length}`);
  console.log(`GET  /rest/v1/${req.params.table} → ${rows.length} rows`);
  res.json(rows);
});

app.head('/rest/v1/:table', (req, res) => {
  const t = db[req.params.table];
  if (!t) return res.status(404).end();
  const rows = applyFilters(t, parseEqFilters(req.query));
  res.setHeader('Content-Range', `*/${rows.length}`);
  res.end();
});

// POST (insert)
app.post('/rest/v1/:table', (req, res) => {
  const t = db[req.params.table];
  if (!t) return res.status(404).json({ message: 'relation does not exist' });

  const body = Array.isArray(req.body) ? req.body : [req.body];
  const inserted = body.map(item => {
    const row = { id: uuid(), created_at: new Date().toISOString(), ...item };
    t.push(row);
    return row;
  });

  console.log(`POST /rest/v1/${req.params.table} →`, inserted);
  res.status(201).json(inserted.length === 1 ? inserted[0] : inserted);
});

// PATCH (update)
app.patch('/rest/v1/:table', (req, res) => {
  const t = db[req.params.table];
  if (!t) return res.status(404).json({ message: 'relation does not exist' });

  const filters = parseEqFilters(req.query);
  const updated = [];
  t.forEach((row, i) => {
    if (Object.entries(filters).every(([k, v]) => String(row[k]) === String(v))) {
      Object.assign(t[i], req.body, { updated_at: new Date().toISOString() });
      updated.push(t[i]);
    }
  });
  console.log(`PATCH /rest/v1/${req.params.table} filters=`, filters, '→', updated.length, 'updated');
  res.json(updated);
});

// DELETE
app.delete('/rest/v1/:table', (req, res) => {
  const t = db[req.params.table];
  if (!t) return res.status(404).json({ message: 'relation does not exist' });

  const filters = parseEqFilters(req.query);
  const deleted = [];
  const keep    = [];
  t.forEach(row => {
    if (Object.entries(filters).every(([k, v]) => String(row[k]) === String(v))) deleted.push(row);
    else keep.push(row);
  });
  t.length = 0; keep.forEach(r => t.push(r));
  console.log(`DELETE /rest/v1/${req.params.table} filters=`, filters, '→', deleted.length, 'deleted');
  res.json(deleted);
});

// Storage (stub)
app.all('/storage/v1/*path', (req, res) => res.json({ message: 'storage not mocked' }));

// ── REALTIME (WebSocket stub) ────────────────────────────────────
wss.on('connection', (ws) => {
  console.log('🔌 Realtime WebSocket connected');
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      // Respond to heartbeat/join
      if (data.event === 'heartbeat') {
        ws.send(JSON.stringify({ event: 'heartbeat', payload: {}, ref: data.ref, topic: data.topic }));
      } else if (data.event === 'phx_join') {
        ws.send(JSON.stringify({ event: 'phx_reply', payload: { status: 'ok', response: {} }, ref: data.ref, topic: data.topic }));
      }
    } catch {}
  });
  ws.on('error', () => {});
});

// Anon key endpoint (supabase-config.js için)
app.get('/local-anon-key', (req, res) => res.json({ key: ANON_KEY }));

// ── STATIC FILES (projeyi de serve et) ───────────────────────────
const projectRoot = path.join(__dirname, '..');
app.use(express.static(projectRoot));

// ── START ────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   NetOnline DS — Local Test Server               ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  🌐  http://localhost:${PORT}                        ║`);
  console.log(`║  📧  Test Email   : admin@test.com               ║`);
  console.log(`║  🔑  Test Şifre   : admin123                     ║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});
