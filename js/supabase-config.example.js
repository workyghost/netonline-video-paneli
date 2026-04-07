// js/supabase-config.example.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "BURAYA_KENDI_SUPABASE_URL_NIZI_GIRIN";
const SUPABASE_ANON_KEY = "BURAYA_KENDI_SUPABASE_ANON_KEY_NIZI_GIRIN";

// Ana istemci (Admin/Dashboard)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Player için ikincil istemci - Auth state dashboard ile çakışmasın diye ayrı bir storageKey kullanıyoruz
export const playerSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: 'netonline-player-auth',
    persistSession: true,
  }
});
