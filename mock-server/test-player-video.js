// test-player-video.js — player'da video oynatma testi
const { chromium } = require('playwright');
const path = require('path');

const BASE = 'http://localhost:3001';
const VIDEO_PATH = path.resolve('C:/Users/murat.dirim/Desktop/uzun.mp4');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page    = await browser.newPage();

  // Network isteklerini izle
  page.on('response', resp => {
    const url = resp.url().replace(BASE, '');
    if (url.includes('storage') || url.includes('videos') || url.includes('screens') || url.includes('playlists')) {
      console.log(`← ${resp.status()} ${url.slice(0, 80)}`);
    }
  });
  page.on('requestfailed', req => {
    const url = req.url().replace(BASE, '');
    if (!url.startsWith('http')) console.log(`✗ FAIL: ${url.slice(0,80)} — ${req.failure()?.errorText}`);
  });
  page.on('console', msg => {
    if (['error','warn'].includes(msg.type())) console.log(`[${msg.type()}] ${msg.text()}`);
  });

  try {
    // --- Login ---
    await page.goto(`${BASE}/index.html`);
    await page.fill('#email', 'admin@test.com');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard.html', { timeout: 8000 });
    console.log('✅ Login');

    // --- Firma ekle ---
    await page.locator('text=Ayarlar').first().click();
    await page.waitForTimeout(600);
    await page.locator('input').first().fill('Test Firma');
    await page.locator('button:has-text("Ekle")').first().click();
    await page.waitForTimeout(800);
    console.log('✅ Firma eklendi');

    // --- Video yükle ---
    await page.locator('text=İçerikler').first().click();
    await page.waitForTimeout(800);
    await page.click('#btn-upload-video');
    await page.waitForTimeout(400);
    await page.locator('#upload-file-input').setInputFiles(VIDEO_PATH);
    await page.waitForTimeout(800);
    await page.fill('#upload-title', 'Uzun Test Video');
    await page.selectOption('#upload-firm', { index: 1 });
    await page.click('#upload-submit-btn');
    // upload tamamlanana kadar bekle
    await page.waitForSelector('#modal-overlay.hidden', { state: 'attached', timeout: 30000 });
    console.log('✅ Video yüklendi');
    await page.waitForTimeout(500);

    // --- Yüklenen videonun file_url'ini al ---
    const { default: http } = await import('http');
    const firmId = await page.evaluate(async () => {
      // firmsMap'ten ilk firma id'sini al
      const resp = await fetch('http://localhost:3001/rest/v1/firms?select=id');
      const data = await resp.json();
      return data[0]?.id;
    });

    const videoUrl = await page.evaluate(async (fId) => {
      const resp = await fetch(`http://localhost:3001/rest/v1/videos?select=id,file_url,file_name&firm_id=eq.${fId}`);
      const data = await resp.json();
      console.log('Videos:', JSON.stringify(data));
      return data[0]?.file_url;
    }, firmId);

    console.log(`📹 Video URL: ${videoUrl}`);

    // --- Video URL'ye GET at ve HTTP status'ü gör ---
    const status = await page.evaluate(async (url) => {
      try {
        const r = await fetch(url, { method: 'GET' });
        return r.status;
      } catch(e) { return 'ERROR: ' + e.message; }
    }, videoUrl);
    console.log(`🔍 Video URL HTTP status: ${status}`);

    // --- Ekran ekle ---
    await page.locator('text=Ekranlar').first().click();
    await page.waitForTimeout(600);
    await page.click('#btn-add-screen');
    await page.waitForTimeout(400);
    await page.selectOption('#ms-firm', { index: 1 });
    await page.fill('#ms-name', 'Test Ekran');
    await page.fill('#ms-location', 'Test Konum');
    await page.click('#ms-save');
    await page.waitForSelector('#modal-overlay.hidden', { state: 'attached', timeout: 8000 });
    console.log('✅ Ekran eklendi');
    await page.waitForTimeout(600);

    // --- Ekranın linkini al ---
    const playerLink = await page.evaluate(() => {
      const btn = document.querySelector('.btn-copy-link');
      if (!btn) return null;
      return window.location.origin + '/player.html?screen=' + btn.dataset.id;
    });
    console.log(`🔗 Player link: ${playerLink}`);

    // --- Player'ı yeni sekmede aç ---
    const playerPage = await browser.newPage();
    playerPage.on('console', msg => {
      console.log(`[PLAYER ${msg.type()}] ${msg.text()}`);
    });
    playerPage.on('response', resp => {
      const url = resp.url().replace(BASE, '');
      if (url.includes('storage') || url.includes('videos') || url.includes('rest')) {
        console.log(`[PLAYER] ← ${resp.status()} ${url.slice(0,80)}`);
      }
    });
    playerPage.on('requestfailed', req => {
      const url = req.url().replace(BASE, '');
      console.log(`[PLAYER] ✗ FAIL: ${url.slice(0,80)} — ${req.failure()?.errorText}`);
    });

    await playerPage.goto(playerLink);
    await playerPage.waitForTimeout(1000);

    // Overlay varsa tıkla
    const overlayVisible = await playerPage.locator('#linkOverlay').isVisible().catch(() => false);
    if (overlayVisible) {
      console.log('👆 Overlay tıklanıyor...');
      await playerPage.click('#linkOverlay');
    }

    console.log('\n⏳ 15 saniye izleniyorum...\n');
    for (let i = 0; i < 5; i++) {
      await playerPage.waitForTimeout(3000);
      const contentError = await playerPage.locator('#contentErrorMsg').isVisible().catch(() => false);
      const noVideos     = await playerPage.locator('#noVideosMsg').isVisible().catch(() => false);
      const mainVideoSrc = await playerPage.locator('#mainVideo').getAttribute('src').catch(() => 'n/a');
      console.log(`[${(i+1)*3}s] contentError=${contentError} noVideos=${noVideos} videoSrc=${mainVideoSrc?.slice(0,60)}`);
      if (contentError) { console.log('❌ "İçerik yüklenemiyor" görüntülendi!'); break; }
    }

  } catch(e) {
    console.log('❌ TEST HATASI:', e.message);
  } finally {
    await browser.close();
  }
})();
