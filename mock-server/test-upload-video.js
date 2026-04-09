// test-upload-video.js — uzun video yükleme testi
const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:3001';
const VIDEO_PATH = path.resolve('C:/Users/murat.dirim/Desktop/uzun.mp4');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();

  // Konsol hatalarını yakala
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log('❌ CONSOLE ERROR:', msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
    console.log('❌ PAGE ERROR:', err.message);
  });
  // Network hatalarını yakala
  page.on('response', resp => {
    if (resp.status() >= 400) {
      console.log(`⚠️  HTTP ${resp.status()} ${resp.url()}`);
    }
  });
  page.on('requestfailed', req => {
    console.log('❌ REQUEST FAILED:', req.url(), req.failure()?.errorText);
  });

  try {
    // 1. Login
    console.log('\n── 1. Login ──');
    await page.goto(`${BASE_URL}/index.html`);
    await page.fill('#email', 'admin@test.com');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard.html', { timeout: 5000 });
    console.log('✅ Giriş başarılı');

    // 2. Firma oluştur
    console.log('\n── 2. Firma oluştur ──');
    // Ayarlar sekmesine git
    const settingsTab = page.locator('text=Ayarlar').first();
    await settingsTab.click();
    await page.waitForTimeout(500);

    // Firma adı input bul
    const firmInput = page.locator('input[placeholder*="firma"], input[placeholder*="Firma"], #firm-name, input[id*="firm"]').first();
    await firmInput.fill('Test Firması');

    // Ekle butonuna tıkla
    const addBtn = page.locator('button:has-text("Ekle"), button:has-text("Kaydet")').first();
    await addBtn.click();
    await page.waitForTimeout(1000);
    console.log('✅ Firma oluşturuldu');

    // 3. İçerikler sekmesine git
    console.log('\n── 3. Video yükleme ──');
    const contentTab = page.locator('text=İçerikler').first();
    await contentTab.click();
    await page.waitForTimeout(1000);

    // Video Yükle butonuna tıkla
    await page.click('#btn-upload-video');
    await page.waitForTimeout(500);

    // Dosya seç
    const fileInput = page.locator('#upload-file-input');
    await fileInput.setInputFiles(VIDEO_PATH);
    await page.waitForTimeout(1000);
    console.log(`📁 Dosya seçildi: ${VIDEO_PATH}`);

    // Form alanlarını doldur
    const titleInput = page.locator('#upload-title');
    await titleInput.fill('Uzun Test Videosu');

    await page.selectOption('#upload-firm', { index: 1 });
    await page.selectOption('#upload-orientation', 'horizontal');

    console.log('🚀 Yükleme başlatılıyor...');
    const uploadStart = Date.now();

    // Upload başlat
    await page.click('#upload-submit-btn');

    // Modal kapanana veya hata çıkana kadar bekle (max 60sn)
    try {
      // state: 'attached' — hidden class'ı olan eleman DOM'da var ama görünmez (display:none)
      await page.waitForSelector('#modal-overlay.hidden', { timeout: 60000, state: 'attached' });
      const elapsed = ((Date.now() - uploadStart) / 1000).toFixed(1);
      console.log(`✅ Yükleme tamamlandı! (${elapsed}s)`);
    } catch (e) {
      // Modal kapanmadı — hata toast'u var mı?
      const toast = await page.locator('.toast, [class*="toast"], [id*="toast"]').textContent().catch(() => null);
      if (toast) console.log('⚠️  Toast mesajı:', toast);

      // Progress durumunu kontrol et
      const pct = await page.locator('#upload-progress-pct').textContent().catch(() => '?');
      const label = await page.locator('#upload-progress-label').textContent().catch(() => '?');
      console.log(`❌ Yükleme zaman aşımı! Progress: ${pct} — ${label}`);
    }

    // 4. Sonuç özeti
    console.log('\n── Sonuç ──');
    if (errors.length) {
      console.log('Hatalar:');
      errors.forEach(e => console.log(' •', e));
    } else {
      console.log('✅ Hata yok');
    }

    await page.waitForTimeout(2000);
  } catch (err) {
    console.log('\n❌ TEST HATASI:', err.message);
  } finally {
    await browser.close();
  }
})();
