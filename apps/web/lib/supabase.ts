"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "./env";

let cached: SupabaseClient | null = null;

// Browser client. Anon key + RLS enforced. NEVER use service role here.
export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(publicEnv.supabaseUrl(), publicEnv.supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
