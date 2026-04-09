// mock-server/test-player.js
// Tam senaryo: firma → video → playlist → ekran → player linki test

const { chromium } = require('playwright');
const path = require('path');

const BASE   = 'http://localhost:3001';
const VIDEO  = path.join('C:\\Users\\murat\\Desktop', 'video_2026-03-29_17-12-15.mp4'); // küçük dosya

async function run() {
  console.log('\n=== Player + Realtime Test ===\n');
  const browser = await chromium.launch({ headless: false, slowMo: 250 });
  const ctx     = await browser.newContext();
  const page    = await ctx.newPage();

  page.on('console', msg => { if (msg.type()==='error') console.log(`[ERR] ${msg.text()}`); });
  // WebSocket frame izle
  page.on('websocket', ws => {
    ws.on('framereceived', frame => {
      const p = typeof frame.payload === 'string' ? frame.payload : '';
      if (p.includes('postgres_changes') || p.includes('phx_reply')) {
        console.log(`  [WS↓] ${p.slice(0, 200)}`);
      }
    });
  });

  // ── Login
  await page.goto(`${BASE}/index.html`);
  await page.waitForLoadState('networkidle');
  await page.fill('#email', 'admin@test.com');
  await page.fill('#password', 'admin123');
  await page.click('#loginButton');
  await page.waitForURL('**/dashboard.html', { timeout: 8000 });
  console.log('✅ Login OK');

  // ── 1. Firma ekle
  await page.click('[data-page="settings"]');
  await page.waitForSelector('#new-firm-input');
  await page.fill('#new-firm-input', 'Player Test Firma');
  await page.click('#btn-add-firm');
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('#firms-list .firm-name-input')).some(i => i.value === 'Player Test Firma')
  , { timeout: 5000 });
  console.log('✅ Firma eklendi');

  // ── 2. Video yükle
  await page.click('[data-page="contents"]');
  await page.waitForSelector('#btn-upload-video');
  await page.click('#btn-upload-video');
  await page.waitForSelector('#upload-drop-zone');
  await page.locator('#upload-file-input').setInputFiles(VIDEO);
  await page.waitForSelector('#upload-form-fields:not(.hidden)', { timeout: 5000 });
  await page.selectOption('#upload-firm', { label: 'Player Test Firma' });
  await page.selectOption('#upload-orientation', { value: 'horizontal' });
  await page.locator('#upload-title').fill('Player Test Video');
  await page.waitForFunction(() => document.getElementById('toast-container')?.children.length === 0, { timeout: 4000 }).catch(() => {});
  await page.click('#upload-submit-btn');
  await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 30000 });
  console.log('✅ Video yüklendi');

  // video id'yi al
  await page.waitForTimeout(500);
  const videoId = await page.evaluate(async () => {
    const resp = await fetch('http://localhost:3001/rest/v1/videos?select=id,title&title=eq.Player Test Video');
    const data = await resp.json();
    return data[0]?.id;
  });
  console.log(`   Video ID: ${videoId}`);

  // ── 3. Playlist oluştur
  await page.click('[data-page="playlists"]');
  await page.waitForSelector('#btn-new-playlist');
  await page.click('#btn-new-playlist');
  await page.waitForSelector('#pl-name');
  await page.fill('#pl-name', 'Test Playlist');
  await page.selectOption('#pl-firm', { label: 'Player Test Firma' });

  // video wrapper görünene kadar bekle
  await page.waitForSelector('#pl-videos-wrap:not(.hidden)', { timeout: 5000 });
  // videoyu seç (checkbox)
  const checkbox = page.locator('#pl-videos-wrap input[type="checkbox"]').first();
  await checkbox.check();
  await page.click('#pl-save');
  await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 5000 });
  console.log('✅ Playlist oluşturuldu');

  // playlist id'yi al
  const playlistId = await page.evaluate(async () => {
    const resp = await fetch('http://localhost:3001/rest/v1/playlists?select=id,name&name=eq.Test Playlist');
    const data = await resp.json();
    return data[0]?.id;
  });
  console.log(`   Playlist ID: ${playlistId}`);

  // ── 4. Ekran oluştur
  console.log('\n4️⃣  Ekran oluşturuluyor...');
  const screensBefore = await page.locator('#screens-tbody tr').count();
  await page.click('[data-page="screens"]');
  await page.waitForSelector('#btn-add-screen');
  await page.click('#btn-add-screen');
  await page.waitForSelector('#ms-firm');
  await page.selectOption('#ms-firm', { label: 'Player Test Firma' });
  await page.fill('#ms-name', 'Test Ekranı');
  await page.fill('#ms-location', 'Test Konum');
  await page.click('input[name="ms-orientation"][value="horizontal"]');
  await page.click('#ms-save');
  await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 5000 });

  // ── Realtime test: ekran hemen listede görünmeli (sayfayı yenilemeden)
  console.log('   Realtime güncelleme bekleniyor...');
  try {
    await page.waitForFunction(
      (before) => document.querySelectorAll('#screens-tbody tr').length > before,
      screensBefore,
      { timeout: 5000 }
    );
    console.log('   ✅ Ekran anında listelendi (realtime çalışıyor!)');
  } catch {
    const screensAfter = await page.locator('#screens-tbody tr').count();
    console.log(`   ❌ Realtime çalışmadı (önce: ${screensBefore}, sonra: ${screensAfter})`);
  }

  // Screen ID al
  const screenId = await page.evaluate(async () => {
    const resp = await fetch('http://localhost:3001/rest/v1/screens?select=id,name&name=eq.Test Ekranı');
    const data = await resp.json();
    return data[0]?.id;
  });
  console.log(`   Screen ID: ${screenId}`);

  // Playlist ata (dropdown)
  if (playlistId && screenId) {
    await page.evaluate(async ({ screenId, playlistId }) => {
      await fetch(`http://localhost:3001/rest/v1/screens?id=eq.${screenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_id: playlistId })
      });
    }, { screenId, playlistId });
    console.log('   ✅ Playlist ekrana atandı');
  }

  // ── 5. Player link testi
  console.log('\n5️⃣  Player testi...');
  const playerPage = await ctx.newPage();
  playerPage.on('console', msg => {
    const t = msg.type();
    if (t === 'error' || t === 'warn') console.log(`  [${t.toUpperCase()}] ${msg.text()}`);
  });
  // Hangi URL'lerin çekildiğini izle
  playerPage.on('response', r => {
    if (r.url().includes('localhost:3001/rest') || r.url().includes('localhost:3001/auth')) {
      console.log(`  [NET] ${r.request().method()} ${r.url().replace('http://localhost:3001','')} → ${r.status()}`);
    }
  });

  await playerPage.goto(`${BASE}/player.html?screen=${screenId}`);
  await playerPage.waitForLoadState('networkidle');

  // Video oynatılmaya başlandı mı?
  await playerPage.waitForTimeout(3000);

  const playerState = await playerPage.evaluate(() => {
    const main = document.getElementById('mainVideo');
    const noVids = document.getElementById('noVideosMsg');
    const errMsg = document.getElementById('contentErrorMsg');
    const linkOverlay = document.getElementById('linkOverlay');
    return {
      playerVisible: !document.getElementById('playerScreen').classList.contains('hidden'),
      noVideos: noVids !== null,
      contentError: errMsg !== null,
      linkOverlayVisible: linkOverlay && !linkOverlay.classList.contains('hidden'),
      videoSrc: main?.src || '(yok)',
      videoReadyState: main?.readyState,
      videoPaused: main?.paused
    };
  });

  console.log(`   Player görünür:     ${playerState.playerVisible}`);
  console.log(`   Link overlay:       ${playerState.linkOverlayVisible}`);
  console.log(`   "Video bulunamadı": ${playerState.noVideos}`);
  console.log(`   "İçerik hatası":    ${playerState.contentError}`);
  console.log(`   Video src:          ${playerState.videoSrc?.slice(0, 80)}`);
  console.log(`   Video readyState:   ${playerState.videoReadyState} (4=HAVE_ENOUGH_DATA)`);

  if (!playerState.noVideos && !playerState.contentError && playerState.playerVisible) {
    console.log('\n✅ Player çalışıyor — video kuyrukta');
  } else if (playerState.noVideos) {
    console.log('\n❌ "Yayınlanacak video bulunamadı" hatası var');
  } else {
    console.log('\n⚠️  Beklenmedik durum');
  }

  console.log('\n=== 20sn sonra kapanır ===');
  await playerPage.waitForTimeout(20000);
  await browser.close();
}

run().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
