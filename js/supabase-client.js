import { SUPABASE_URL, SUPABASE_ANON_KEY, isConfigured } from "./config.js";

const CDN = "https://esm.sh/@supabase/supabase-js@2";

let clientPromise = null;

export function getSupabase() {
  if (!isConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import(CDN).then(({ createClient }) =>
      createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim(), {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    );
  }
  return clientPromise;
}
