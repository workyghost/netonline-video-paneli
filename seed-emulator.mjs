// seed-emulator.mjs — Emulator'a admin kullanıcı ve firma verisi ekler
// Kullanım: node seed-emulator.mjs

const AUTH_URL = "http://127.0.0.1:9099";
const FIRESTORE_URL = "http://127.0.0.1:8080";
const PROJECT_ID = "netonline-video-paneli";

async function createUser() {
  const res = await fetch(`${AUTH_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@netonline.com",
      password: "admin123",
      returnSecureToken: true
    })
  });

  if (res.ok) {
    const data = await res.json();
    console.log("Admin kullanıcı oluşturuldu:");
    console.log("  E-posta: admin@netonline.com");
    console.log("  Şifre:   admin123");
    return data.idToken;
  } else {
    const err = await res.json();
    if (err.error?.message === "EMAIL_EXISTS") {
      console.log("Admin kullanıcı zaten mevcut, giriş yapılıyor...");
      // Sign in instead
      const loginRes = await fetch(`${AUTH_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@netonline.com",
          password: "admin123",
          returnSecureToken: true
        })
      });
      const loginData = await loginRes.json();
      return loginData.idToken;
    }
    throw new Error(`Kullanıcı oluşturulamadı: ${JSON.stringify(err)}`);
  }
}

async function seedFirms(idToken) {
  const firms = ["Nethouse", "Kıbrısonline", "Broadmax", "Multimax"];

  // Check if firms already exist
  const checkRes = await fetch(
    `${FIRESTORE_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/firms?pageSize=1`,
    { headers: { "Authorization": `Bearer ${idToken}` } }
  );
  const checkData = await checkRes.json();

  if (checkData.documents && checkData.documents.length > 0) {
    console.log("Firmalar zaten mevcut, seed atlandı.");
    return;
  }

  for (const name of firms) {
    const res = await fetch(
      `${FIRESTORE_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/firms`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          fields: {
            name: { stringValue: name },
            createdAt: { timestampValue: new Date().toISOString() }
          }
        })
      }
    );

    if (res.ok) {
      console.log(`  Firma eklendi: ${name}`);
    } else {
      console.error(`  Firma eklenemedi: ${name}`, await res.text());
    }
  }
}

async function main() {
  console.log("Firebase Emulator Seed Script");
  console.log("============================\n");

  try {
    // Check if emulator is running
    const healthCheck = await fetch(`${AUTH_URL}/`).catch(() => null);
    if (!healthCheck) {
      console.error("HATA: Firebase Emulator çalışmıyor!");
      console.error("Önce 'firebase emulators:start' komutunu çalıştırın.");
      process.exit(1);
    }

    const idToken = await createUser();
    console.log("");
    await seedFirms(idToken);
    console.log("\nSeed tamamlandı!");
    console.log("\nGiriş bilgileri:");
    console.log("  URL:    http://127.0.0.1:5000");
    console.log("  E-posta: admin@netonline.com");
    console.log("  Şifre:   admin123");
  } catch (error) {
    console.error("Hata:", error.message);
    process.exit(1);
  }
}

main();
