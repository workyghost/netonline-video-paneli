// mock-server/test.js
const { chromium } = require('playwright');

const BASE = 'http://localhost:3001';
const EMAIL = 'admin@test.com';
const PASS  = 'admin123';

const errors = [];
const log = (msg) => console.log(`  ${msg}`);
const ok  = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => { console.log(`  ❌ ${msg}`); errors.push(msg); };

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext();
  const page    = await ctx.newPage();

  // Tüm konsol mesajlarını yakala
  const consoleErrors = [];
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error') {
      consoleErrors.push(msg.text());
      console.log(`  🔴 [${type}] ${msg.text()}`);
    } else if (type === 'warn') {
      console.log(`  🟡 [${type}] ${msg.text()}`);
    } else if (type === 'log') {
      const t = msg.text();
      if (t.startsWith('[AUTH]') || t.startsWith('[DB]')) {
        console.log(`  ℹ️  ${t}`);
      }
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
    console.log(`  🔴 Page error: ${err.message}`);
  });

  // ── TEST 1: Login sayfası yükleniyor mu? ─────────────────────
  console.log('\n── Test 1: Login sayfası ──');
  await page.goto(BASE);
  await page.waitForLoadState('networkidle').catch(() => {});
  const title = await page.title();
  log(`Sayfa başlığı: ${title}`);
  const loginForm = await page.$('#loginForm');
  loginForm ? ok('Login formu var') : fail('Login formu YOK');

  // ── TEST 2: Login ─────────────────────────────────────────────
  console.log('\n── Test 2: Giriş yap ──');
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASS);
  await page.click('#loginButton');

  // dashboard.html'e yönlendirme bekle
  try {
    await page.waitForURL('**/dashboard.html', { timeout: 5000 });
    ok('dashboard.html\'e yönlendirildi');
  } catch {
    fail(`dashboard.html\'e yönlendirilmedi. URL: ${page.url()}`);
    // Hata mesajı var mı?
    const errMsg = await page.$eval('#errorMessage', el => el.textContent).catch(() => '');
    if (errMsg) fail(`Login hata mesajı: ${errMsg}`);
  }

  // ── DIAGNOSTICS: Sayfanın içinde ne oluyor? ────────────────
  await page.waitForTimeout(2000);
  const diagInfo = await page.evaluate(async () => {
    return {
      url: window.location.href,
      pageOverviewHidden: document.getElementById('page-overview')?.classList.contains('hidden'),
      userEmail: document.getElementById('user-email')?.textContent,
      localStorageKeys: Object.keys(localStorage),
      supabaseDefined: typeof window.__supabase !== 'undefined'
    };
  });
  console.log('  📊 Sayfa durumu:', JSON.stringify(diagInfo, null, 2));

  // ── TEST 3: Genel Bakış otomatik açıldı mı? ──────────────────
  console.log('\n── Test 3: Genel Bakış otomatik açılıyor mu? ──');
  await page.waitForTimeout(1500); // JS init için bekle
  const overviewVisible = await page.$eval('#page-overview', el => !el.classList.contains('hidden')).catch(() => false);
  overviewVisible ? ok('Genel Bakış sayfası açık') : fail('Genel Bakış sayfası açılmadı (hidden)');

  // ── TEST 4: Firma yoksa uyarı banner ─────────────────────────
  console.log('\n── Test 4: Firma yoksa uyarı banner ──');
  const banner = await page.$('#no-firms-banner');
  banner ? ok('Firma uyarı banner\'ı görünüyor') : fail('Firma uyarı banner\'ı YOK');

  // ── TEST 5: Ayarlar sayfasına git ────────────────────────────
  console.log('\n── Test 5: Ayarlar sayfasına git ──');
  await page.click('[data-page="settings"]');
  await page.waitForTimeout(500);
  const settingsVisible = await page.$eval('#page-settings', el => !el.classList.contains('hidden')).catch(() => false);
  settingsVisible ? ok('Ayarlar sayfası açık') : fail('Ayarlar sayfası açılmadı');

  // firms-list var mı?
  const firmsList = await page.$('#firms-list');
  firmsList ? ok('Firma listesi container\'ı var') : fail('Firma listesi container\'ı YOK');

  // ── TEST 6: Firma ekle ────────────────────────────────────────
  console.log('\n── Test 6: Firma ekle ──');
  await page.fill('#new-firm-input', 'Test Firma A');

  // Network isteği izle
  const insertPromise = page.waitForResponse(
    res => res.url().includes('/rest/v1/firms') && res.request().method() === 'POST',
    { timeout: 5000 }
  ).catch(() => null);

  await page.click('#btn-add-firm');
  const insertRes = await insertPromise;

  if (insertRes) {
    const status = insertRes.status();
    const body   = await insertRes.json().catch(() => ({}));
    if (status === 201) {
      ok(`Firma eklendi (HTTP ${status}): ${JSON.stringify(body)}`);
    } else {
      fail(`Firma ekleme başarısız (HTTP ${status}): ${JSON.stringify(body)}`);
    }
  } else {
    fail('Firma ekleme isteği hiç gönderilmedi');
  }

  await page.waitForTimeout(800);

  // Liste güncellenmiş mi?
  const firmRows = await page.$$('.firm-name-input');
  firmRows.length > 0 ? ok(`Listede ${firmRows.length} firma görünüyor`) : fail('Listede firma görünmüyor');

  // Toast geldi mi?
  // (toast 3.5 sn sonra kaybolur, hızlıca kontrol et)
  const toastEl = await page.$('#toast-container div');
  toastEl ? ok('Toast bildirimi görüntülendi') : log('Toast zaten kaybolmuş (normal)');

  // ── TEST 7: Firma düzenle ─────────────────────────────────────
  console.log('\n── Test 7: Firma düzenle ──');
  const firmInput = await page.$('.firm-name-input');
  if (firmInput) {
    await firmInput.click({ clickCount: 3 });
    await firmInput.fill('Test Firma A Düzenlendi');
    await page.waitForTimeout(300);
    const saveBtn = await page.$('.btn-save-firm:not(.hidden)');
    if (saveBtn) {
      await saveBtn.click();
      await page.waitForTimeout(500);
      ok('Firma güncelleme isteği gönderildi');
    } else {
      fail('Kaydet butonu görünmüyor (hidden kaldı)');
    }
  } else {
    fail('Düzenlenecek firma input\'u bulunamadı');
  }

  // ── TEST 8: Firma sil ─────────────────────────────────────────
  console.log('\n── Test 8: Firma sil ──');
  page.once('dialog', dialog => {
    log(`Confirm dialog: "${dialog.message()}"`);
    dialog.accept();
  });
  const deleteBtn = await page.$('.btn-delete-firm');
  if (deleteBtn) {
    await deleteBtn.click();
    await page.waitForTimeout(800);
    const remainingFirms = await page.$$('.firm-name-input');
    remainingFirms.length === 0 ? ok('Firma silindi, liste boş') : fail(`Firma silinmedi, listede ${remainingFirms.length} firma var`);
  } else {
    fail('Silme butonu bulunamadı');
  }

  // ── TEST 9: Genel Bakış'a dön — banner tekrar görünmeli ───────
  console.log('\n── Test 9: Genel Bakış banner (firma silinince tekrar görünür mü?) ──');
  await page.click('[data-page="overview"]');
  await page.waitForTimeout(1000);
  const bannerAfterDelete = await page.$('#no-firms-banner');
  bannerAfterDelete ? ok('Banner firma silinince tekrar görünüyor') : fail('Banner firma silinince görünmedi');

  // ── TEST 10: Şifre değiştir ───────────────────────────────────
  console.log('\n── Test 10: Şifre değiştir ──');
  await page.click('[data-page="settings"]');
  await page.waitForTimeout(400);
  await page.fill('#pw-current', PASS);
  await page.fill('#pw-new', 'yeniSifre123');
  await page.fill('#pw-confirm', 'yeniSifre123');
  await page.click('#btn-change-pw');
  await page.waitForTimeout(1000);
  const pwError = await page.$eval('#pw-error', el => el.textContent).catch(() => '');
  if (!pwError || pwError.trim() === '') {
    ok('Şifre değiştirme — hata mesajı yok (başarılı)');
  } else {
    fail(`Şifre değiştirme hatası: ${pwError}`);
  }

  // ── TEST 11: Yanlış mevcut şifre testi ───────────────────────
  console.log('\n── Test 11: Yanlış mevcut şifre ──');
  // Settings'e tekrar git (şifre alanları sıfırlanmış olabilir)
  await page.click('[data-page="settings"]');
  await page.waitForTimeout(400);
  // Butonun enabled olmasını bekle
  await page.waitForSelector('#btn-change-pw:not([disabled])', { timeout: 5000 }).catch(() => {});
  await page.fill('#pw-current', 'yanlisSifre');
  await page.fill('#pw-new', 'abc123');
  await page.fill('#pw-confirm', 'abc123');
  await page.click('#btn-change-pw');
  await page.waitForTimeout(1500);
  const pwError2 = await page.$eval('#pw-error', el => el.textContent).catch(() => '');
  pwError2.includes('yanlış') ? ok(`Doğru hata mesajı: "${pwError2}"`) : fail(`Beklenen hata gelmedi. Hata: "${pwError2}"`);

  // ── SONUÇ ─────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  if (errors.length === 0 && consoleErrors.length === 0) {
    console.log('🎉 TÜM TESTLER BAŞARILI!');
  } else {
    if (errors.length > 0) {
      console.log(`\n❌ ${errors.length} TEST BAŞARISIZ:`);
      errors.forEach(e => console.log(`   - ${e}`));
    }
    if (consoleErrors.length > 0) {
      console.log(`\n🔴 ${consoleErrors.length} CONSOLE HATASI:`);
      consoleErrors.forEach(e => console.log(`   - ${e}`));
    }
  }
  console.log('══════════════════════════════════════════\n');

  await browser.close();
  process.exit(errors.length > 0 || consoleErrors.length > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('\n💥 Test crash:', err.message);
  process.exit(1);
});
