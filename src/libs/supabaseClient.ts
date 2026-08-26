// src/libs/supabaseClient.ts
//
// The single Supabase client for the whole app. Everything that used to go
// through the Express backend now goes through here.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly in dev rather than silently 401-ing on every request.
  console.error(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. " +
      "Copy .env.example to .env and fill them in."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Set persistSession to false to go back to the old "log in on every page
    // load" behaviour of the in-memory AuthContext.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "envoy-auth",
  },
});

export default supabase;
