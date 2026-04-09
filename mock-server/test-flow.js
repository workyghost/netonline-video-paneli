// mock-server/test-flow.js
// Playwright ile uçtan uca test: login → firma ekle → video yükle

const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:3001';
const EMAIL    = 'admin@test.com';
const PASS     = 'admin123';

const DESKTOP = 'C:\\Users\\murat\\Desktop';
const VIDEOS  = [
  path.join(DESKTOP, '0329.mp4'),
  path.join(DESKTOP, 'video_2026-03-29_17-12-15.mp4')
];

async function run() {
  console.log('\n=== NetOnline DS — Playwright Test Başlıyor ===\n');

  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const ctx     = await browser.newContext();
  const page    = await ctx.newPage();

  // Console mesajlarını göster
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
  });
  page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));
  // Hatalı resource'ları bul
  page.on('response', resp => {
    if (resp.status() >= 400) console.log(`[HTTP ${resp.status()}] ${resp.url()}`);
  });
  page.on('requestfailed', req => {
    console.log(`[FAIL] ${req.url()} — ${req.failure()?.errorText}`);
  });

  // ── 1. LOGIN ────────────────────────────────────────────────────
  console.log('1️⃣  Login sayfası açılıyor...');
  await page.goto(BASE_URL + '/index.html');
  await page.waitForLoadState('networkidle');

  await page.fill('#email', EMAIL);
  await page.fill('#password', PASS);
  await page.click('#loginButton');

  console.log('   → Login bekleniyor...');
  await page.waitForURL('**/dashboard.html', { timeout: 8000 });
  console.log('   ✅ Dashboard\'a ulaşıldı\n');

  // ── 2. AYARLAR → FİRMA EKLE ────────────────────────────────────
  console.log('2️⃣  Ayarlar sayfasına gidiliyor...');
  await page.click('[data-page="settings"]');
  await page.waitForSelector('#new-firm-input', { timeout: 5000 });

  await page.fill('#new-firm-input', 'Nethouse');
  await page.click('#btn-add-firm');

  console.log('   → Firma eklendi, liste bekleniyor...');
  // Firmanın listede görünmesini bekle (adı input value'da)
  await page.waitForFunction(() => {
    const inputs = document.querySelectorAll('#firms-list .firm-name-input');
    return Array.from(inputs).some(i => i.value.includes('Nethouse'));
  }, { timeout: 8000 });
  console.log('   ✅ "Nethouse" firması oluşturuldu\n');

  // ── 3. İÇERİKLER → VİDEO YÜKLE ────────────────────────────────
  console.log('3️⃣  İçerikler sayfasına gidiliyor...');
  await page.click('[data-page="contents"]');
  await page.waitForSelector('#btn-upload-video', { timeout: 5000 });

  for (let i = 0; i < VIDEOS.length; i++) {
    const videoPath = VIDEOS[i];
    const videoName = path.basename(videoPath);
    console.log(`\n   📹 Video ${i + 1}/${VIDEOS.length}: ${videoName}`);

    await page.click('#btn-upload-video');
    await page.waitForSelector('#upload-drop-zone', { timeout: 4000 });

    // Dosya input'una doğrudan yükle
    const fileInput = page.locator('#upload-file-input');
    await fileInput.setInputFiles(videoPath);

    // Form alanlarının görünmesini bekle
    await page.waitForSelector('#upload-form-fields:not(.hidden)', { timeout: 5000 });

    // Firma seç
    await page.selectOption('#upload-firm', { label: 'Nethouse' });

    // Başlık (tek video için)
    const titleInput = page.locator('#upload-title');
    if (await titleInput.isVisible()) {
      await titleInput.fill(`Test Video ${i + 1} - ${videoName.replace(/\.[^/.]+$/, '')}`);
    }

    // Önce mevcut tüm toast'ların silinmesini bekle
    await page.waitForFunction(() =>
      document.getElementById('toast-container')?.children.length === 0
    , { timeout: 5000 }).catch(() => {});

    console.log(`   → Yükle butonuna tıklanıyor...`);
    await page.click('#upload-submit-btn');

    // Modal kapanmasını bekle (upload tamamlanınca closeModal() çağrılır)
    // state:'hidden' → display:none olmasını bekle
    try {
      await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 60000 });
      console.log(`   ✅ Video ${i + 1} yükleme tamamlandı (modal kapandı)`);
    } catch (e) {
      console.log(`   ⚠️  Modal 60s içinde kapanmadı`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Toast varsa oku
    const toastEl = page.locator('#toast-container div').first();
    if (await toastEl.isVisible().catch(() => false)) {
      const toastText = await toastEl.textContent().catch(() => '');
      console.log(`   📣 Toast: "${toastText}"`);
    }

    await page.waitForTimeout(1000);
  }

  // ── 4. SONUÇ ────────────────────────────────────────────────────
  console.log('\n4️⃣  Video listesi kontrol ediliyor...');
  await page.waitForTimeout(2000);

  const isEmpty = await page.locator('#contents-empty:not(.hidden)').isVisible();
  const hasTable = await page.locator('#contents-table-wrap:not(.hidden)').isVisible();

  if (hasTable) {
    const rows = await page.locator('#contents-tbody tr').count();
    console.log(`   ✅ Video tablosunda ${rows} video listelendi`);
  } else if (isEmpty) {
    console.log('   ❌ Video tablosu boş - yükleme başarısız olmuş olabilir');
  }

  console.log('\n=== Test tamamlandı. Tarayıcı 30sn sonra kapanır ===\n');
  await page.waitForTimeout(30000);
  await browser.close();
}

run().catch(e => {
  console.error('\n[FATAL]', e.message);
  process.exit(1);
});
