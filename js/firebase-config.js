// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, connectAuthEmulator, onAuthStateChanged, signInWithEmailAndPassword, signInAnonymously, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator, collection, doc, addDoc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, query, where, orderBy, onSnapshot, serverTimestamp, enableNetwork, disableNetwork } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { getStorage, connectStorageEmulator, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "demo-key",
  authDomain: "netonline-video-paneli.firebaseapp.com",
  projectId: "netonline-video-paneli",
  storageBucket: "netonline-video-paneli.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:demo"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Player için ayrı app instance — admin dashboard ile auth state çakışmasını önler.
// Firebase Auth IndexedDB'yi aynı origin'deki tüm tablar arasında paylaşır.
// Ayrı app adı kullanarak player'ın anonim auth'u farklı bir key'e yazılır,
// böylece dashboard'un onAuthStateChanged'i tetiklenmez.
const playerApp = initializeApp(firebaseConfig, 'netonline-player');
const playerAuth = getAuth(playerApp);
const playerDb = getFirestore(playerApp);

// Emulator bağlantıları (lokal geliştirme)
const USE_EMULATORS = window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';

if (USE_EMULATORS) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectAuthEmulator(playerAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(playerDb, "127.0.0.1", 8080);
}

export {
  auth, db, storage,
  playerAuth, playerDb,
  onAuthStateChanged, signInWithEmailAndPassword, signInAnonymously, signOut,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  collection, doc, addDoc, getDoc, getDocs, setDoc, deleteDoc, updateDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, enableNetwork, disableNetwork,
  ref, uploadBytesResumable, getDownloadURL, deleteObject
};
