import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Read-only client with the anon key. Returns null while Supabase is not configured. */
export function createPublicClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false } });
}
