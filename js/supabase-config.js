// js/supabase-config.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://your-project-id.supabase.co"; // TODO: Projenizin Supabase URL'sini girin
const SUPABASE_ANON_KEY = "your-anon-key"; // TODO: Projenizin Supabase ANON KEY'ini girin

// Ana istemci (Admin/Dashboard)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Player için ikincil istemci - Auth state dashboard ile çakışmasın diye ayrı bir storageKey kullanıyoruz
export const playerSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: 'netonline-player-auth',
    persistSession: true,
  }
});
