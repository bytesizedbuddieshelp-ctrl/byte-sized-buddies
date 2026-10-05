import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseKey, supabaseUrl, isConfigured } from './config';

// The signed-in client, used only by the admin screens. It uses the public key.
// What the owner may do is decided by the database rules (row-level security), not by this file.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isConfigured) return null;
  client ??= createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}
