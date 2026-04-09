// js/supabase-config.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

let SUPABASE_URL, SUPABASE_ANON_KEY;

if (isLocal) {
  // Lokal mock server: anon key'i server'dan çek (geçerli JWT formatında)
  SUPABASE_URL = 'http://localhost:3001';
  const res = await fetch('http://localhost:3001/local-anon-key');
  const { key } = await res.json();
  SUPABASE_ANON_KEY = key;
} else {
  // Prodüksiyon: değerler deploy sırasında HTML'e enjekte edilen window global'lardan okunur.
  // index.html / dashboard.html / player.html içindeki <script> bloğuna bakın.
  SUPABASE_URL      = window.__SUPABASE_URL;
  SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY;
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };

// Ana istemci (Admin/Dashboard)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Player için ikincil istemci
export const playerSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: 'netonline-player-auth',
    persistSession: true,
  }
});
