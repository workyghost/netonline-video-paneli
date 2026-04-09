// mock-server/test-quick.js
// Hızlı test: thumbnail + silme işlemleri

const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:3001';
const VIDEO    = path.join('C:\\Users\\murat\\Desktop', '0329.mp4');

async function run() {
  console.log('\n=== Hızlı Test: thumbnail + silme ===\n');

  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page    = await (await browser.newContext()).newPage();

  page.on('console', msg => { if (msg.type() === 'error') console.log(`[ERR] ${msg.text()}`); });

  // ── Login
  await page.goto(`${BASE_URL}/index.html`);
  await page.waitForLoadState('networkidle');
  await page.fill('#email', 'admin@test.com');
  await page.fill('#password', 'admin123');
  await page.click('#loginButton');
  await page.waitForURL('**/dashboard.html', { timeout: 8000 });
  console.log('✅ Login OK');

  // ── Firma ekle (test için)
  await page.click('[data-page="settings"]');
  await page.waitForSelector('#new-firm-input');
  await page.fill('#new-firm-input', 'Test Firma');
  await page.click('#btn-add-firm');
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('#firms-list .firm-name-input')).some(i => i.value === 'Test Firma')
  , { timeout: 6000 });
  console.log('✅ Firma eklendi');

  // ── Video yükle
  await page.click('[data-page="contents"]');
  await page.waitForSelector('#btn-upload-video');
  await page.click('#btn-upload-video');
  await page.waitForSelector('#upload-drop-zone');

  await page.locator('#upload-file-input').setInputFiles(VIDEO);
  await page.waitForSelector('#upload-form-fields:not(.hidden)', { timeout: 5000 });

  await page.selectOption('#upload-firm', { label: 'Test Firma' });
  await page.selectOption('#upload-orientation', { value: 'horizontal' });
  await page.locator('#upload-title').fill('Thumbnail Test Videosu');

  // Toast'ları temizle
  await page.waitForFunction(() => document.getElementById('toast-container')?.children.length === 0, { timeout: 4000 }).catch(() => {});

  await page.click('#upload-submit-btn');
  await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 60000 });
  console.log('✅ Video yüklendi');

  // ── Thumbnail kontrol
  await page.waitForTimeout(1000);
  const thumbImg = page.locator('#contents-tbody img').first();
  const thumbSrc = await thumbImg.getAttribute('src').catch(() => null);
  const thumbVisible = await thumbImg.isVisible().catch(() => false);

  console.log(`\n📷 Thumbnail durumu:`);
  console.log(`   src: ${thumbSrc || '(yok)'}`);

  if (thumbSrc) {
    // Thumbnail URL'ini test et
    const thumbResp = await page.evaluate(async (url) => {
      const r = await fetch(url);
      return { status: r.status, type: r.headers.get('content-type') };
    }, thumbSrc);
    console.log(`   HTTP: ${thumbResp.status}, Content-Type: ${thumbResp.type}`);
    if (thumbResp.type?.includes('image')) {
      console.log('   ✅ Thumbnail görsel olarak döndü');
    } else {
      console.log(`   ❌ Thumbnail görsel değil: ${thumbResp.type}`);
    }
  } else {
    console.log('   ❌ img src yok — thumbnail DB\'ye kaydedilmedi');
  }

  // ── Video silme testi
  console.log('\n🗑️  Video silme testi...');
  const deleteBtn = page.locator('#contents-tbody .btn-delete-video').first();
  page.once('dialog', d => d.accept());
  await deleteBtn.click();
  await page.waitForTimeout(1500);
  const emptyVisible = await page.locator('#contents-empty:not(.hidden)').isVisible();
  const tableHidden  = await page.locator('#contents-table-wrap.hidden').count() > 0;
  console.log(`   empty görünür: ${emptyVisible}, tablo gizli: ${tableHidden}`);
  console.log((emptyVisible || tableHidden) ? '   ✅ Video silindi' : '   ❌ Video silinemedi');

  // ── Firma silme testi
  console.log('\n🏢 Firma silme testi...');
  await page.click('[data-page="settings"]');
  await page.waitForSelector('#firms-list');
  // "Test Firma" satırını bul ve sil
  const firmRows = await page.locator('#firms-list .firm-name-input').all();
  let firmDeleted = false;
  for (const input of firmRows) {
    const val = await input.inputValue();
    if (val === 'Test Firma') {
      const deleteBtn = input.locator('xpath=../button[contains(@class, "btn-delete-firm")]');
      page.once('dialog', d => d.accept());
      await deleteBtn.click();
      await page.waitForTimeout(1500);
      firmDeleted = true;
      break;
    }
  }

  const remainingFirms = await page.locator('#firms-list .firm-name-input').all();
  let testFirmaGone = true;
  for (const input of remainingFirms) {
    if (await input.inputValue() === 'Test Firma') { testFirmaGone = false; break; }
  }

  console.log(testFirmaGone ? '   ✅ Firma silindi' : '   ❌ Firma hâlâ listede');

  console.log('\n=== Test tamamlandı. 15sn sonra kapanır ===\n');
  await page.waitForTimeout(15000);
  await browser.close();
}

run().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
