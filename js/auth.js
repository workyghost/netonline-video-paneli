// js/auth.js
import {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  seedFirms
} from "./firebase-config.js";

// DOM elementleri
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorMessage = document.getElementById("errorMessage");
const loginButton = document.getElementById("loginButton");
const loginButtonText = document.getElementById("loginButtonText");
const loginSpinner = document.getElementById("loginSpinner");

// Firebase hata kodlarını Türkçeye çevir
function getErrorMessage(errorCode) {
  const messages = {
    "auth/invalid-email": "Geçersiz e-posta adresi.",
    "auth/user-disabled": "Bu hesap devre dışı bırakılmış.",
    "auth/user-not-found": "Bu e-posta ile kayıtlı hesap bulunamadı.",
    "auth/wrong-password": "Şifre hatalı.",
    "auth/invalid-credential": "E-posta veya şifre hatalı.",
    "auth/too-many-requests": "Çok fazla başarısız deneme. Lütfen bir süre bekleyin.",
    "auth/network-request-failed": "Ağ hatası. İnternet bağlantınızı kontrol edin."
  };
  return messages[errorCode] || "Giriş yapılırken bir hata oluştu.";
}

// Hata mesajını göster
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
}

// Hata mesajını gizle
function hideError() {
  errorMessage.classList.add("hidden");
}

// Loading durumunu ayarla
function setLoading(isLoading) {
  loginButton.disabled = isLoading;
  loginButtonText.textContent = isLoading ? "Giriş yapılıyor..." : "Giriş Yap";
  loginSpinner.classList.toggle("hidden", !isLoading);
}

// Oturum kontrolü — zaten giriş yapılmışsa dashboard'a yönlendir
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "dashboard.html";
  }
});

// Form submit
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
  setLoading(true);

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // Başarılı giriş — firma seed kontrolü yap
    await seedFirms();
    // onAuthStateChanged zaten dashboard'a yönlendirecek
  } catch (error) {
    showError(getErrorMessage(error.code));
    setLoading(false);
  }
});
