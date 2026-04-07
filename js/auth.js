// js/auth.js
import { supabase } from "./supabase-config.js";

// DOM elementleri
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorMessage = document.getElementById("errorMessage");
const loginButton = document.getElementById("loginButton");
const loginButtonText = document.getElementById("loginButtonText");
const loginSpinner = document.getElementById("loginSpinner");

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
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
    if (session && session.user) {
      window.location.href = "dashboard.html";
    }
  }
});

// Form submit
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
  setLoading(true);

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  const { error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    showError(error.message === "Invalid login credentials" ? "E-posta veya şifre hatalı." : error.message);
    setLoading(false);
  } else {
    // onAuthStateChange tetiklenip dashboard'a yönlendirecek
  }
});
