// test-upload-api.js — video upload'u doğrudan API üzerinden test et
const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE = 'http://localhost:3001';
const VIDEO = 'C:/Users/murat.dirim/Desktop/uzun.mp4';

function request(method, url, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = { method, hostname: u.hostname, port: u.port, path: u.pathname + u.search, headers };
    const req = http.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch { resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // 1. Login
  console.log('── 1. Login ──');
  const loginRes = await request('POST', `${BASE}/auth/v1/token?grant_type=password`,
    { 'Content-Type': 'application/json' },
    JSON.stringify({ email: 'admin@test.com', password: 'admin123' })
  );
  const token = loginRes.body.access_token;
  console.log(`✅ Token: ${token.slice(0, 30)}...`);

  // 2. Firma oluştur
  console.log('\n── 2. Firma oluştur ──');
  const firmRes = await request('POST', `${BASE}/rest/v1/firms`,
    { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    JSON.stringify({ name: 'Test Firma' })
  );
  const firmId = firmRes.body.id;
  console.log(`✅ Firma: ${firmId}`);

  // 3. Video upload (büyük dosya)
  console.log('\n── 3. Video Upload ──');
  const stat = fs.statSync(VIDEO);
  const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
  console.log(`📁 Dosya: ${VIDEO} (${sizeMB} MB)`);

  const fileName = `test_${Date.now()}_uzun.mp4`;
  const uploadUrl = `${BASE}/storage/v1/object/digital-signage/videos/${fileName}`;

  const startTime = Date.now();

  // Stream ile yükle
  await new Promise((resolve, reject) => {
    const u = new URL(uploadUrl);
    const req = http.request({
      method: 'POST',
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const body = JSON.parse(Buffer.concat(chunks).toString());
        if (res.statusCode === 200) {
          console.log(`✅ Upload başarılı! (${elapsed}s) Key: ${body.Key}`);
        } else {
          console.log(`❌ Upload hata! HTTP ${res.statusCode}:`, body);
        }
        resolve();
      });
    });
    req.on('error', err => { console.log('❌ Upload request error:', err.message); reject(err); });

    // Progress log
    let sent = 0;
    const readStream = fs.createReadStream(VIDEO);
    readStream.on('data', chunk => {
      sent += chunk.length;
      process.stdout.write(`\r📤 ${(sent / 1024 / 1024).toFixed(1)} MB / ${sizeMB} MB`);
    });
    readStream.on('end', () => process.stdout.write('\n'));
    readStream.pipe(req);
  });

  // 4. DB'ye video kaydı ekle
  console.log('\n── 4. Video DB kaydı ──');
  const fileUrl = `${BASE}/storage/v1/object/public/digital-signage/videos/${fileName}`;
  const dbRes = await request('POST', `${BASE}/rest/v1/videos`,
    { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    JSON.stringify({
      title: 'Test Uzun Video',
      firm_id: firmId,
      orientation: 'horizontal',
      file_name: fileName,
      file_url: fileUrl,
      thumbnail_url: '',
      is_active: true,
      expires_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  );
  console.log(dbRes.status === 201 ? `✅ Video DB kaydı oluştu: ${dbRes.body.id}` : `❌ DB hata: ${JSON.stringify(dbRes.body)}`);

  console.log('\n✅ Test tamamlandı!');
}

main().catch(e => console.error('TEST HATASI:', e.message));
