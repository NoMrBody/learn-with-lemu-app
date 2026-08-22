import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

// For use in Client Components. Safe to call on every render — it's cheap.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
