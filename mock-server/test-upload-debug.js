// test-upload-debug.js — upload ağ isteklerini tam izle
const { chromium } = require('playwright');
const path = require('path');

const BASE_URL  = 'http://localhost:3001';
const VIDEO_PATH = path.resolve('C:/Users/murat.dirim/Desktop/uzun.mp4');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const page    = await browser.newPage();

  // TÜM network isteklerini logla
  page.on('request',  req  => console.log(`→ ${req.method()} ${req.url().replace(BASE_URL,'')}`));
  page.on('response', resp => {
    const url = resp.url().replace(BASE_URL,'');
    if (!url.startsWith('/storage') && !url.endsWith('.js') && !url.endsWith('.html') && !url.endsWith('.css') && !url.endsWith('local-anon-key')) return;
    console.log(`← ${resp.status()} ${url}`);
  });
  page.on('requestfailed', req => console.log(`✗ FAIL: ${req.url().replace(BASE_URL,'')} — ${req.failure()?.errorText}`));
  page.on('console', msg => {
    if (['error','warning'].includes(msg.type())) console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  try {
    // Login
    await page.goto(`${BASE_URL}/index.html`);
    await page.fill('#email', 'admin@test.com');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard.html', { timeout: 8000 });
    console.log('\n✅ Giriş tamam');

    // Ayarlar → firma ekle
    await page.locator('text=Ayarlar').first().click();
    await page.waitForTimeout(600);
    const firmInput = page.locator('input').filter({ hasText: '' }).nth(0);
    await firmInput.fill('Debug Firma');
    await page.locator('button:has-text("Ekle")').first().click();
    await page.waitForTimeout(800);
    console.log('✅ Firma eklendi');

    // İçerikler sekmesi
    await page.locator('text=İçerikler').first().click();
    await page.waitForTimeout(800);

    // Upload modalı aç
    await page.click('#btn-upload-video');
    await page.waitForTimeout(400);

    // Dosya seç
    await page.locator('#upload-file-input').setInputFiles(VIDEO_PATH);
    await page.waitForTimeout(600);

    // Form doldur
    await page.fill('#upload-title', 'Debug Video');
    await page.selectOption('#upload-firm', { index: 1 });
    await page.selectOption('#upload-orientation', 'horizontal');

    console.log('\n🚀 Upload başlıyor...');

    // Upload başlat ve ağ isteklerini izle
    await page.click('#upload-submit-btn');

    // 30 sn bekle, her 5 sn'de progress'i logla
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(5000);
      const pct   = await page.locator('#upload-progress-pct').textContent().catch(() => 'n/a');
      const label = await page.locator('#upload-progress-label').textContent().catch(() => 'n/a');
      const hidden = await page.locator('#modal-overlay').getAttribute('class').catch(() => '?');
      console.log(`  [${(i+1)*5}s] progress=${pct} | label=${label} | modal=${hidden?.includes('hidden') ? 'CLOSED' : 'OPEN'}`);
      if (hidden?.includes('hidden')) { console.log('✅ Modal kapandı!'); break; }
    }
  } catch (err) {
    console.log('❌ TEST HATASI:', err.message);
  } finally {
    await browser.close();
  }
})();
