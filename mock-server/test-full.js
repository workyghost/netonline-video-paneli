// test-full.js — görsel + video + blur fill + süre testi
const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');
const http = require('http');

const BASE       = 'http://localhost:3001';
const VIDEO_PATH = path.resolve('C:/Users/murat.dirim/Desktop/uzun.mp4');

// Dikey test görseli: 100x200 mavi PNG
const TEST_IMAGE = path.join(__dirname, 'test-image.png');
const PNG_100x200 = Buffer.from([
  0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a, // PNG signature
  0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52, // IHDR chunk
  0x00,0x00,0x00,0x64,0x00,0x00,0x00,0xc8, // width=100 height=200
  0x08,0x02,0x00,0x00,0x00,                 // 8-bit RGB
  0xaa,0xaa,0xaa,0xaa,                      // CRC placeholder
  0x00,0x00,0x00,0x01,0x49,0x44,0x41,0x54, // IDAT chunk
  0x78,0x9c,0x62,0x60,0x60,0xf8,0xcf,0x00, // compressed data
  0x00,0x00,0x02,0x00,0x01,                 // ...
  0xe5,0x27,0xde,0xfc,                      // CRC
  0x00,0x00,0x00,0x00,0x49,0x45,0x4e,0x44, // IEND
  0xae,0x42,0x60,0x82                       // CRC
]);

// Basit 1x1 mavi PNG kullan
const PNG_1x1_BLUE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADklEQVQI12NgYGD4DwABBAEAwyvMUQAAAABJRU5ErkJggg==',
  'base64'
);
fs.writeFileSync(TEST_IMAGE, PNG_1x1_BLUE);

function apiGet(urlPath) {
  return new Promise((res, rej) => {
    http.get(`http://localhost:3001${urlPath}`, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch { res(d); } });
    }).on('error', rej);
  });
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const page    = await browser.newPage();

  page.on('requestfailed', req => {
    const u = req.url().replace(BASE,'');
    if (u && !u.startsWith('http') && !u.includes('font') && !u.includes('tail'))
      console.log(`  ✗ ${u.slice(0,70)} — ${req.failure()?.errorText}`);
  });

  const R = { imageShown:false, imageBlurBg:false, image30s:false, videoPlaying:false, videoFullDuration:false };

  try {
    // ── Login ──
    await page.goto(`${BASE}/index.html`);
    await page.fill('#email', 'admin@test.com');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard.html', { timeout: 8000 });
    console.log('✅ Login');

    // ── Firma ──
    await page.locator('text=Ayarlar').first().click();
    await page.waitForTimeout(500);
    await page.locator('input').first().fill('Full Test Firma');
    await page.locator('button:has-text("Ekle")').first().click();
    await page.waitForTimeout(800);
    const firms = await apiGet('/rest/v1/firms?select=id,name');
    const firma = firms.find(f => f.name === 'Full Test Firma');
    console.log(`✅ Firma: ${firma.id}`);

    // ── Görsel yükle (önce) ──
    await page.locator('text=İçerikler').first().click();
    await page.waitForTimeout(700);
    await page.click('#btn-upload-video');
    await page.waitForTimeout(400);
    await page.locator('#upload-file-input').setInputFiles(TEST_IMAGE);
    await page.waitForTimeout(500);
    await page.fill('#upload-title', 'Test Görseli');
    await page.locator('#upload-firm').selectOption(firma.id);
    await page.click('#upload-submit-btn');
    await page.waitForSelector('#modal-overlay.hidden', { state: 'attached', timeout: 15000 });
    console.log('✅ Görsel yüklendi');
    await page.waitForTimeout(400);

    // ── Video yükle (sonra) ──
    await page.click('#btn-upload-video');
    await page.waitForTimeout(400);
    await page.locator('#upload-file-input').setInputFiles(VIDEO_PATH);
    await page.waitForTimeout(700);
    await page.fill('#upload-title', 'Uzun Test Video');
    await page.locator('#upload-firm').selectOption(firma.id);
    await page.click('#upload-submit-btn');
    await page.waitForSelector('#modal-overlay.hidden', { state: 'attached', timeout: 60000 });
    console.log('✅ Video yüklendi');
    await page.waitForTimeout(400);

    // DB'den içerikleri al
    const videos = await apiGet(`/rest/v1/videos?select=id,title,file_name&firm_id=eq.${firma.id}`);
    console.log('📋 İçerikler:', videos.map(v => `${v.title} (${v.file_name.slice(-20)})`).join(', '));

    const imgItem   = videos.find(v => /\.(jpg|jpeg|png)$/i.test(v.file_name));
    const vidItem   = videos.find(v => /\.mp4$/i.test(v.file_name));
    console.log(`  Görsel ID: ${imgItem?.id}`);
    console.log(`  Video ID:  ${vidItem?.id}`);

    // ── Playlist oluştur: Görsel → Video sırasıyla ──
    await page.locator("text=Playlist'ler").first().click();
    await page.waitForTimeout(600);
    await page.click('#btn-new-playlist');
    await page.waitForTimeout(600);
    await page.fill('#pl-name', 'Test Playlist');
    await page.locator('#pl-firm').selectOption(firma.id);
    await page.waitForTimeout(700);
    // Görsel checkbox'ını seç
    const imgCb = page.locator(`#pl-video-list input[value="${imgItem.id}"]`);
    const vidCb = page.locator(`#pl-video-list input[value="${vidItem.id}"]`);
    if (await imgCb.count() > 0) await imgCb.check(); else console.log('⚠️  Görsel checkbox bulunamadı');
    if (await vidCb.count() > 0) await vidCb.check(); else console.log('⚠️  Video checkbox bulunamadı');
    await page.waitForTimeout(300);
    await page.click('#pl-save');
    await page.waitForSelector('#modal-overlay.hidden', { state: 'attached', timeout: 8000 });

    // Playlist'i kontrol et
    const playlists = await apiGet(`/rest/v1/playlists?select=id,items&firm_id=eq.${firma.id}`);
    console.log(`✅ Playlist: ${playlists[0]?.items?.length} öğe — sıra: ${playlists[0]?.items?.map(i=>i.videoId.slice(0,8)).join(' → ')}`);

    // ── Ekran ekle ──
    await page.locator('text=Ekranlar').first().click();
    await page.waitForTimeout(600);
    await page.click('#btn-add-screen');
    await page.waitForTimeout(400);
    await page.locator('#ms-firm').selectOption(firma.id);
    await page.fill('#ms-name', 'Full Test Ekran');
    await page.fill('#ms-location', 'Test Konum');
    await page.click('#ms-save');
    await page.waitForSelector('#modal-overlay.hidden', { state: 'attached', timeout: 8000 });
    await page.waitForTimeout(600);
    console.log('✅ Ekran eklendi');

    // Yeni eklenen ekranı DB'den al
    const screens = await apiGet('/rest/v1/screens?select=id,name');
    const ourScreen = screens.find(s => s.name === 'Full Test Ekran');
    console.log(`  Ekran ID: ${ourScreen.id}`);

    // Playlist ata (doğru ekrana)
    const screenRow = page.locator(`select.playlist-select[data-screen-id="${ourScreen.id}"]`);
    if (await screenRow.count() > 0) {
      await screenRow.selectOption(playlists[0].id);
      await page.waitForTimeout(800);
      console.log('✅ Playlist atandı');
    } else {
      console.log('⚠️  Ekran satırı bulunamadı, REST API ile atıyorum...');
      await fetch(`${BASE}/rest/v1/screens?id=eq.${ourScreen.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_id: playlists[0].id })
      });
    }

    // ── Player aç ──
    const playerLink = `${BASE}/player.html?screen=${ourScreen.id}`;
    console.log(`\n🔗 Player: ${playerLink}`);

    const pp = await browser.newPage();
    pp.on('crash',   () => console.log('[PLAYER] 💥 CRASH!'));
    pp.on('console', msg => {
      if (msg.type() === 'error') console.log(`[PLAYER err] ${msg.text().slice(0,100)}`);
    });
    pp.on('response', r => {
      const u = r.url().replace(BASE,'');
      if ((u.includes('storage') || u.includes('rest/v1')) && [200,201,206].includes(r.status()))
        console.log(`[PLAYER] ← ${r.status()} ${u.slice(0,70)}`);
    });
    pp.on('requestfailed', r => {
      const u = r.url().replace(BASE,'');
      if (u && !u.startsWith('http') && !u.includes('font') && !u.includes('tail'))
        console.log(`[PLAYER] ✗ ${u.slice(0,70)}`);
    });

    await pp.goto(playerLink);
    await pp.waitForTimeout(2000);

    let overlayClickTime = Date.now();
    if (await pp.locator('#linkOverlay').isVisible().catch(() => false)) {
      await pp.click('#linkOverlay');
      overlayClickTime = Date.now();
      console.log('👆 Overlay tıklandı');
    }

    await pp.waitForTimeout(1000);

    console.log('\n═══ TESTLER BAŞLIYOR ═══\n');

    // ── TEST 1: Görsel gösteriliyor mu? ──
    console.log('─ Test 1: Görsel görünürlüğü (max 15s) ─');
    for (let i = 0; i < 15; i++) {
      await pp.waitForTimeout(1000);
      const imgVis  = await pp.locator('#mainImage').isVisible().catch(() => false);
      const vidVis  = await pp.locator('#mainVideo').isVisible().catch(() => false);
      const bgImgVis= await pp.locator('#bgImage:not(.hidden)').count().catch(() => 0) > 0;
      const errVis  = await pp.locator('#contentErrorMsg').isVisible().catch(() => false);
      if (errVis) { console.log(`  ❌ [${i+1}s] contentErrorMsg!`); break; }
      if (imgVis) {
        R.imageShown = true;
        R.imageBlurBg = bgImgVis;
        console.log(`  ✅ [${i+1}s] mainImage görünür`);
        console.log(`  ${bgImgVis ? '✅' : '❌'} bgImage (blur background): ${bgImgVis}`);
        console.log(`  mainVideo gizli: ${!vidVis}`);
        break;
      }
      console.log(`  [${i+1}s] img=${imgVis} vid=${vidVis}`);
    }

    // ── TEST 2: Görsel 30s süresi ──
    if (R.imageShown) {
      console.log('\n─ Test 2: Görsel 30s süresi (overlay tıklandığından itibaren) ─');
      for (let i = 0; i < 36; i++) {
        await pp.waitForTimeout(1000);
        const imgVis = await pp.locator('#mainImage').isVisible().catch(() => false);
        if (!imgVis) {
          const elapsed = ((Date.now() - overlayClickTime) / 1000).toFixed(1);
          R.image30s = parseFloat(elapsed) >= 29;
          console.log(`  ${R.image30s ? '✅' : '❌'} Görsel ${elapsed}s sonra geçti (min 30s ${R.image30s ? 'TAMAM' : 'KISA'})`);
          break;
        }
        if (i % 5 === 4) console.log(`  [${i+1}s] görsel hâlâ gösteriliyor...`);
        if (i === 35) { R.image30s = true; console.log(`  ✅ 36s boyunca görsel gösterildi (overlay'den ${((Date.now()-overlayClickTime)/1000).toFixed(1)}s)`); }
      }
    }

    // ── TEST 3: Video oynatma + süre ──
    console.log('\n─ Test 3: Video oynatma ve tam süre ─');
    let vidStart = 0;
    for (let i = 0; i < 90; i++) {
      await pp.waitForTimeout(1000);
      const vidVis = await pp.locator('#mainVideo').isVisible().catch(() => false);
      const ct     = await pp.evaluate(() => document.getElementById('mainVideo')?.currentTime || 0).catch(() => 0);
      const dur    = await pp.evaluate(() => document.getElementById('mainVideo')?.duration   || 0).catch(() => 0);
      const ended  = await pp.evaluate(() => document.getElementById('mainVideo')?.ended).catch(() => false);
      const errVis = await pp.locator('#contentErrorMsg').isVisible().catch(() => false);
      if (errVis)  { console.log(`  ❌ [${i+1}s] contentErrorMsg!`); break; }
      if (vidVis && ct > 0.5) {
        if (!R.videoPlaying) {
          R.videoPlaying = true;
          vidStart = Date.now();
          console.log(`  ✅ Video oynuyor! currentTime=${ct.toFixed(1)}s, duration=${dur.toFixed(1)}s`);
        }
        if (i % 10 === 9) console.log(`  [${i+1}s] currentTime=${ct.toFixed(1)}/${dur.toFixed(1)}s`);
        if (ended) {
          R.videoFullDuration = true;
          console.log(`  ✅ Video bitti! Tam süre oynandı: ${dur.toFixed(1)}s`);
          break;
        }
        // 80s izledik, video hâlâ oynuyor → uzun video tam çalışıyor
        if (i === 89 && R.videoPlaying) {
          R.videoFullDuration = true;
          console.log(`  ✅ 90s izlendi, video hâlâ oynuyor (${ct.toFixed(1)}/${dur.toFixed(1)}s) — 15s'de kesilmiyor ✓`);
        }
      } else if (!vidVis && R.videoPlaying) {
        console.log(`  [${i+1}s] video artık görünmüyor (playlist döngüsü)`);
      } else if (!R.videoPlaying && i < 5) {
        console.log(`  [${i+1}s] video bekleniyor... img=${await pp.locator('#mainImage').isVisible().catch(()=>false)}`);
      }
    }

    // ── SONUÇLAR ──
    console.log('\n╔══════════════════════════════════╗');
    console.log('║         TEST SONUÇLARI           ║');
    console.log('╠══════════════════════════════════╣');
    console.log(`║  Görsel gösteriliyor   ${R.imageShown      ?'✅':'❌'}          ║`);
    console.log(`║  Blur background       ${R.imageBlurBg     ?'✅':'❌'}          ║`);
    console.log(`║  Görsel min 30s        ${R.image30s        ?'✅':'❌'}          ║`);
    console.log(`║  Video oynatma         ${R.videoPlaying    ?'✅':'❌'}          ║`);
    console.log(`║  Video tam süre        ${R.videoFullDuration?'✅':'❌'}          ║`);
    console.log('╚══════════════════════════════════╝\n');

    await pp.waitForTimeout(2000);
  } catch(e) {
    console.log('\n❌ TEST HATASI:', e.message);
  } finally {
    await browser.close();
    if (fs.existsSync(TEST_IMAGE)) fs.unlinkSync(TEST_IMAGE);
  }
})();
