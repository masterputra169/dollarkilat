import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env.js";

// Service-role client. Bypasses RLS — only use in trusted backend code.
// Frontend uses anon key with RLS enforced.
export const supabaseAdmin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  },
);
