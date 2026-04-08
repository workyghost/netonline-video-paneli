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
  // Prodüksiyon: gerçek Supabase
  SUPABASE_URL     = 'https://digital-signage-supabase.hnx0gp.easypanel.host';
  SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';
}

// Ana istemci (Admin/Dashboard)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Player için ikincil istemci
export const playerSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: 'netonline-player-auth',
    persistSession: true,
  }
});
