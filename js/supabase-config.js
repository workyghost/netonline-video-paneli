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
  SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjk5OTk5OTk5OTl9.OCkt5uV97wfEQcSWx0_0_pt6IoWJdczxiE6l3MJbgIA';
}

export { SUPABASE_URL };

// Ana istemci (Admin/Dashboard)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Player için ikincil istemci
export const playerSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: 'netonline-player-auth',
    persistSession: true,
  }
});
