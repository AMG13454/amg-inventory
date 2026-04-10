import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser / API-route client (anon key, safe to expose)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-only client (service role key — bypasses RLS, never sent to browser)
export function createServerClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export type Supply = {
  id: number;
  inventory_id: string | null;
  name: string;
  description: string | null;
  quantity: string | null;
  reorder_level: string | null;
  expiration_date: string | null;
  qty_on_reorder: string | null;
  expired: string | null;
  location: string | null;
  manufacturer: string | null;
  notes: string | null;
  needs_reorder: boolean;
  category: string;
  lot_number: string | null;
  is_archived: boolean;
  updated_at: string;
};
