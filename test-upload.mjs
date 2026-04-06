// test-upload.mjs — Emülatöre test videoları yükler (Nethouse firması)
// Kullanım: node test-upload.mjs

import { readFileSync } from "fs";
import { existsSync } from "fs";

const AUTH_URL      = "http://127.0.0.1:9099";
const FIRESTORE_URL = "http://127.0.0.1:8080";
const STORAGE_URL   = "http://127.0.0.1:9199";
const PROJECT_ID    = "netonline-video-paneli";
const BUCKET        = "netonline-video-paneli.firebasestorage.app";

async function signIn() {
  const res = await fetch(
    `${AUTH_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@netonline.com", password: "admin123", returnSecureToken: true })
    }
  );
  const data = await res.json();
  if (!data.idToken) throw new Error("Giriş başarısız: " + JSON.stringify(data));
  return data.idToken;
}

async function getNethouse(idToken) {
  const res = await fetch(
    `${FIRESTORE_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/firms`,
    { headers: { "Authorization": `Bearer ${idToken}` } }
  );
  const data = await res.json();
  for (const d of (data.documents || [])) {
    if (d.fields?.name?.stringValue === "Nethouse") {
      return d.name.split("/").pop();
    }
  }
  return null;
}

async function uploadVideo(idToken, filePath, storageName) {
  const fileData = readFileSync(filePath);
  const encoded  = encodeURIComponent(storageName);

  // Upload
  const upRes = await fetch(
    `${STORAGE_URL}/v0/b/${BUCKET}/o?name=${storageName}&uploadType=media`,
    {
      method: "POST",
      headers: {
        "Content-Type": "video/mp4",
        "Authorization": `Bearer ${idToken}`
      },
      body: fileData
    }
  );
  if (!upRes.ok) throw new Error("Storage upload başarısız: " + await upRes.text());

  // Get download token
  const metaRes = await fetch(
    `${STORAGE_URL}/v0/b/${BUCKET}/o/${encoded}`,
    { headers: { "Authorization": `Bearer ${idToken}` } }
  );
  const meta  = await metaRes.json();
  const token = meta.downloadTokens;
  return `${STORAGE_URL}/v0/b/${BUCKET}/o/${encoded}?alt=media&token=${token}`;
}

async function createVideoDoc(idToken, { title, firmId, orientation, fileName, fileUrl }) {
  const res = await fetch(
    `${FIRESTORE_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/videos`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({
        fields: {
          title:        { stringValue: title },
          firmId:       { stringValue: firmId },
          orientation:  { stringValue: orientation },
          fileName:     { stringValue: fileName },
          fileUrl:      { stringValue: fileUrl },
          thumbnailUrl: { stringValue: "" },
          isActive:     { booleanValue: true },
          expiresAt:    { nullValue: null },
          createdAt:    { timestampValue: new Date().toISOString() },
          updatedAt:    { timestampValue: new Date().toISOString() }
        }
      })
    }
  );
  if (!res.ok) throw new Error("Firestore write başarısız: " + await res.text());
  const doc = await res.json();
  return doc.name.split("/").pop();
}

async function main() {
  console.log("NetOnline — Test Video Yükleme");
  console.log("================================\n");

  // Emülatör kontrolü
  const health = await fetch(`${AUTH_URL}/`).catch(() => null);
  if (!health) {
    console.error("HATA: Emülatör çalışmıyor. Önce 'firebase emulators:start' çalıştırın.");
    process.exit(1);
  }

  const idToken = await signIn();
  console.log("Admin girişi başarılı.\n");

  const firmId = await getNethouse(idToken);
  if (!firmId) {
    console.error("HATA: Nethouse firması bulunamadı. Önce 'node seed-emulator.mjs' çalıştırın.");
    process.exit(1);
  }
  console.log(`Nethouse firmId: ${firmId}\n`);

  const files = [
    { path: "01.mp4", title: "Test Video 01", orientation: "horizontal" },
    { path: "02.mp4", title: "Test Video 02", orientation: "horizontal" }
  ];

  for (const f of files) {
    if (!existsSync(f.path)) {
      console.warn(`  UYARI: ${f.path} bulunamadı, atlandı.`);
      continue;
    }

    process.stdout.write(`Yükleniyor: ${f.path} ... `);
    const fileName    = `${Date.now()}_${f.path}`;
    const storagePath = `videos/${fileName}`;
    const fileUrl     = await uploadVideo(idToken, f.path, storagePath);
    const docId       = await createVideoDoc(idToken, {
      title: f.title,
      firmId,
      orientation: f.orientation,
      fileName,
      fileUrl
    });
    console.log(`OK  →  doc: ${docId}`);
  }

  console.log("\nTamamlandı! Player'ı test edin:");
  console.log("  http://127.0.0.1:5000/player.html");
  console.log("  http://127.0.0.1:5000/dashboard.html");
}

main().catch(e => {
  console.error("\nHata:", e.message);
  process.exit(1);
});
