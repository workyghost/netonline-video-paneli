// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, updateDoc, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

async function seedFirms() {
  const firmNames = ["Nethouse", "Kıbrısonline", "Broadmax", "Multimax"];
  const firmsRef = collection(db, "firms");
  const snapshot = await getDocs(firmsRef);

  if (snapshot.empty) {
    for (const name of firmNames) {
      const firmDoc = doc(firmsRef);
      await setDoc(firmDoc, {
        name: name,
        createdAt: serverTimestamp()
      });
    }
    console.log("Firmalar başarıyla eklendi.");
  } else {
    console.log("Firmalar zaten mevcut, seed atlandı.");
  }
}

export {
  auth, db, storage,
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  collection, doc, getDocs, setDoc, deleteDoc, updateDoc,
  query, where, orderBy, serverTimestamp,
  ref, uploadBytesResumable, getDownloadURL, deleteObject,
  seedFirms
};
