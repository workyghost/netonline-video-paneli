// mock-server/server.js
// Supabase API + Static file server — local test ortamı

const express = require('express');
const http    = require('http');
const crypto  = require('crypto');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');
const WebSocket = require('ws');

// Video dosyaları için geçici disk dizini — her sunucu başlatmada sıfırlanır
const TEMP_STORAGE = path.join(os.tmpdir(), 'netonline-mock-storage');
if (fs.existsSync(TEMP_STORAGE)) fs.rmSync(TEMP_STORAGE, { recursive: true, force: true });
fs.mkdirSync(TEMP_STORAGE, { recursive: true });

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

// Anonymous signup (player için)
app.post('/auth/v1/signup', (req, res) => {
  const anonId = uuid();
  const token  = makeToken(anonId, '');
  const expiresIn = 86400;
  res.json({
    access_token: token,
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    refresh_token: uuid(),
    user: {
      id: anonId, email: '', role: 'anon', aud: 'authenticated',
      is_anonymous: true,
      created_at: new Date().toISOString(),
      app_metadata: { provider: 'anonymous' },
      user_metadata: {}
    }
  });
});

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

  // .single() veya .maybeSingle() çağrısı: tek nesne dön
  const isSingle = (req.headers['accept'] || '').includes('pgrst.object');
  if (isSingle) {
    if (rows.length === 0) {
      return res.status(406).json({ message: 'JSON object requested, multiple (or no) rows returned' });
    }
    res.setHeader('Content-Range', `0-0/1`);
    console.log(`GET  /rest/v1/${req.params.table} (single) → 1 row`);
    return res.json(rows[0]);
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
  inserted.forEach(row => broadcastChange(req.params.table, 'INSERT', row));
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
  updated.forEach(row => broadcastChange(req.params.table, 'UPDATE', row));
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
  deleted.forEach(row => broadcastChange(req.params.table, 'DELETE', row));
});

// ── STORAGE (in-memory, upload/download destekli) ────────────────
const storageFiles = new Map(); // path → { buffer, contentType }

// 1x1 şeffaf PNG — thumbnail placeholder
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

// Express 5: *path parametresi dizi döndürür, string'e çeviriyoruz
function parsePath(params) {
  const p = params.path ?? params[0] ?? '';
  return Array.isArray(p) ? p.join('/') : String(p);
}

// Yükleme: POST /storage/v1/object/{bucket}/{path}
app.post('/storage/v1/object/*path', async (req, res) => {
  const storagePath = parsePath(req.params);
  const contentType = req.headers['content-type'] || 'application/octet-stream';
  const isImg = /\.(jpg|jpeg|png|webp|gif)$/i.test(storagePath);

  if (isImg) {
    // Görseller belleğe alınır (küçük dosyalar)
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      storageFiles.set(storagePath, { buffer: buf, contentType: 'image/jpeg' });
      console.log(`📦 Storage upload (image): ${storagePath} (${buf.length} bytes)`);
      res.status(200).json({ Key: storagePath, Id: uuid() });
    });
    req.on('error', () => res.status(500).json({ error: 'upload failed' }));
  } else {
    // Videolar ve diğer büyük dosyalar diske yazılır
    const safeName = storagePath.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const diskPath = path.join(TEMP_STORAGE, safeName);
    const writeStream = fs.createWriteStream(diskPath);
    req.pipe(writeStream);
    writeStream.on('finish', () => {
      const size = fs.statSync(diskPath).size;
      storageFiles.set(storagePath, { diskPath, contentType });
      console.log(`📦 Storage upload (disk): ${storagePath} (${(size/1024/1024).toFixed(1)} MB)`);
      res.status(200).json({ Key: storagePath, Id: uuid() });
    });
    writeStream.on('error', () => res.status(500).json({ error: 'upload failed' }));
    req.on('error', () => writeStream.destroy());
  }
});

// Dosya indirme: GET /storage/v1/object/public/{bucket}/{path}
app.get('/storage/v1/object/public/*path', (req, res) => {
  const storagePath = parsePath(req.params);
  const stored = storageFiles.get(storagePath);

  if (stored) {
    if (stored.diskPath) {
      // Diskten serve et — Range request desteği (video seeking için gerekli)
      const stat = fs.statSync(stored.diskPath);
      const range = req.headers.range;
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', stored.contentType);
      if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
        const start = parseInt(startStr, 10);
        const end   = endStr ? parseInt(endStr, 10) : stat.size - 1;
        res.writeHead(206, {
          'Content-Range':  `bytes ${start}-${end}/${stat.size}`,
          'Content-Length': end - start + 1,
        });
        fs.createReadStream(stored.diskPath, { start, end }).pipe(res);
      } else {
        res.setHeader('Content-Length', stat.size);
        fs.createReadStream(stored.diskPath).pipe(res);
      }
      return;
    }
    // Bellekteki dosya (görsel)
    res.setHeader('Content-Type', stored.contentType);
    return res.send(stored.buffer);
  }

  // Kayıtlı dosya yok — görsel için placeholder PNG dön
  if (/\.(jpg|jpeg|png|webp|gif)$/i.test(storagePath)) {
    res.setHeader('Content-Type', 'image/png');
    return res.send(PLACEHOLDER_PNG);
  }
  res.status(404).json({ error: 'not found', message: storagePath + ' bulunamadı' });
});

// Silme
app.delete('/storage/v1/object/*path', (req, res) => {
  const storagePath = parsePath(req.params);
  storageFiles.delete(storagePath);
  res.json([{ name: storagePath }]);
});

// Diğer storage istekleri
app.all('/storage/v1/*path', (req, res) => res.json({ message: 'storage not mocked' }));

// ── REALTIME (WebSocket — Phoenix array protocol + postgres_changes) ─
// Supabase realtime v2: mesajlar [joinRef, ref, topic, event, payload] dizisi
// ws → [ { joinRef, topic, tables: [{ table, schema, event }] } ]
const wsChannels = new Map();

// Phoenix array formatında mesaj gönder
function wsSend(ws, joinRef, ref, topic, event, payload) {
  if (ws.readyState !== ws.constructor.OPEN) return;
  ws.send(JSON.stringify([joinRef, ref, topic, event, payload]));
}

wss.on('connection', (ws) => {
  wsChannels.set(ws, []);
  console.log('🔌 Realtime WebSocket connected');

  ws.on('message', (rawMsg, isBinary) => {
    if (isBinary) { console.log('📨 WS binary frame received'); return; }
    try {
      const raw = rawMsg.toString();
      const data = JSON.parse(raw);
      console.log(`📨 ${raw.slice(0, 120)}`);
      // Phoenix array: [joinRef, ref, topic, event, payload]
      const [joinRef, ref, topic, event, payload] = Array.isArray(data)
        ? data
        : [null, data.ref, data.topic, data.event, data.payload];

      if (event === 'heartbeat') {
        wsSend(ws, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} });
      } else if (event === 'phx_join') {
        const pgChanges = payload?.config?.postgres_changes || [];
        // Her subscription'a benzersiz ID ata (client bunu broadcast eşleştirmesinde kullanır)
        const tablesWithIds = pgChanges.map(t => ({ ...t, id: Math.floor(Math.random() * 2e9) }));
        const channels = wsChannels.get(ws) || [];
        channels.push({ joinRef, topic, tables: tablesWithIds });
        wsChannels.set(ws, channels);
        console.log(`📡 phx_join: ${topic} tables=[${tablesWithIds.map(t=>t.table).join(',')}]`);
        // Supabase v2: response.postgres_changes içinde ID'leri gönder
        wsSend(ws, joinRef, ref, topic, 'phx_reply', {
          status: 'ok',
          response: { postgres_changes: tablesWithIds }
        });
      } else if (event === 'phx_leave') {
        wsChannels.set(ws, (wsChannels.get(ws) || []).filter(c => c.topic !== topic));
        wsSend(ws, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} });
      }
    } catch {}
  });
  ws.on('close', () => wsChannels.delete(ws));
  ws.on('error', () => {});
});

// DB değişikliğini tüm ilgili WebSocket client'larına yayınla
function broadcastChange(table, type, record, oldRecord = {}) {
  wsChannels.forEach((channels, ws) => {
    channels.forEach(ch => {
      // Bu kanaldaki hangi subscriptions'lar bu tabloyu izliyor?
      const matchingIds = ch.tables
        .filter(t => (t.table === table || t.table === '*') && (t.event === '*' || t.event === type))
        .map(t => t.id);

      if (matchingIds.length === 0) return;

      const payload = {
        data: {
          commit_timestamp: new Date().toISOString(),
          type,
          schema: 'public',
          table,
          record:     (type !== 'DELETE') ? record    : {},
          old_record: (type === 'DELETE')  ? oldRecord : {},
          errors: null
        },
        ids: matchingIds   // ← Supabase client bu ID'lerle subscription'ı eşleştirir
      };

      wsSend(ws, null, null, ch.topic, 'postgres_changes', payload);
      console.log(`📤 broadcast ${type} on ${table} (ids:${matchingIds}) → ${ch.topic}`);
    });
  });
}

// Anon key endpoint (supabase-config.js için)
app.get('/local-anon-key', (req, res) => res.json({ key: ANON_KEY }));

// Favicon — 404 hatalarını önle
app.get('/favicon.ico', (req, res) => res.status(204).end());

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
