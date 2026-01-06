import { createClient } from "@supabase/supabase-js";

export function getServiceSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server environment variables.");
  }
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
    },
  });
}
