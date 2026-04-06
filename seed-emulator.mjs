// seed-emulator.mjs — Emulator'a admin kullanıcı ve firma verisi ekler
// Kullanım: node seed-emulator.mjs
//
// ⚠️  Bu script SADECE lokal geliştirme içindir.
//    firebase emulators:start sonrası çalıştır: node seed-emulator.mjs
//    Production'da ÇALIŞTIRMA.

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
    // Return existing firm IDs
    const allRes = await fetch(
      `${FIRESTORE_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/firms`,
      { headers: { "Authorization": `Bearer ${idToken}` } }
    );
    const allData = await allRes.json();
    return (allData.documents || []).map(d => d.name.split("/").pop());
  }

  const firmIds = [];
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
      const data = await res.json();
      const firmId = data.name.split("/").pop();
      firmIds.push(firmId);
      console.log(`  Firma eklendi: ${name} (${firmId})`);
    } else {
      console.error(`  Firma eklenemedi: ${name}`, await res.text());
    }
  }
  return firmIds;
}

async function seedScreens(idToken, firmIds) {
  // Check if screens already exist
  const checkRes = await fetch(
    `${FIRESTORE_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/screens?pageSize=1`,
    { headers: { "Authorization": `Bearer ${idToken}` } }
  );
  const checkData = await checkRes.json();

  if (checkData.documents && checkData.documents.length > 0) {
    console.log("Ekranlar zaten mevcut, seed atlandı.");
    return;
  }

  const now = new Date().toISOString();
  const screens = [
    {
      firmId: firmIds[0],
      name: "A Şubesi - Giriş TV",
      location: "İstanbul, Kadıköy",
      orientation: "horizontal",
      status: "offline",
      currentVideoId: null,
      currentVideoTitle: null,
      playlistId: null,
    },
    {
      firmId: firmIds[1] || firmIds[0],
      name: "B Şubesi - Lobi TV",
      location: "Ankara, Çankaya",
      orientation: "vertical",
      status: "offline",
      currentVideoId: null,
      currentVideoTitle: null,
      playlistId: null,
    }
  ];

  for (const screen of screens) {
    const res = await fetch(
      `${FIRESTORE_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/screens`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          fields: {
            firmId: { stringValue: screen.firmId },
            name: { stringValue: screen.name },
            location: { stringValue: screen.location },
            orientation: { stringValue: screen.orientation },
            status: { stringValue: screen.status },
            lastSeen: { timestampValue: now },
            currentVideoId: { nullValue: null },
            currentVideoTitle: { nullValue: null },
            playlistId: { nullValue: null },
            registeredAt: { timestampValue: now }
          }
        })
      }
    );

    if (res.ok) {
      console.log(`  Ekran eklendi: ${screen.name}`);
    } else {
      console.error(`  Ekran eklenemedi: ${screen.name}`, await res.text());
    }
  }
}

async function seedPlaylists(idToken, firmIds) {
  // Check if playlists already exist
  const checkRes = await fetch(
    `${FIRESTORE_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/playlists?pageSize=1`,
    { headers: { "Authorization": `Bearer ${idToken}` } }
  );
  const checkData = await checkRes.json();

  if (checkData.documents && checkData.documents.length > 0) {
    console.log("Playlist'ler zaten mevcut, seed atlandı.");
    return;
  }

  const now = new Date().toISOString();
  const res = await fetch(
    `${FIRESTORE_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/playlists`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({
        fields: {
          firmId: { stringValue: firmIds[0] },
          name: { stringValue: "Örnek Playlist" },
          items: { arrayValue: { values: [] } },
          createdAt: { timestampValue: now },
          updatedAt: { timestampValue: now }
        }
      })
    }
  );

  if (res.ok) {
    console.log("  Playlist eklendi: Örnek Playlist");
  } else {
    console.error("  Playlist eklenemedi:", await res.text());
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
    const firmIds = await seedFirms(idToken);
    console.log("");
    await seedScreens(idToken, firmIds);
    await seedPlaylists(idToken, firmIds);
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
