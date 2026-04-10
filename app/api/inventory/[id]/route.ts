import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { toISODate } from '@/lib/dates';
import { toTitleCase } from '@/lib/strings';

const ALLOWED = ['name', 'quantity', 'reorder_level', 'expiration_date', 'location', 'notes', 'needs_reorder', 'category', 'lot_number', 'ref_sku', 'manufacturer'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => ALLOWED.includes(k))
  );

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });

  if ('location' in updates && !updates.location)
    return NextResponse.json({ error: 'Location is required to save an item.' }, { status: 400 });

  // needs_reorder comes in as 0/1 from the UI — coerce to boolean for Supabase
  if ('needs_reorder' in updates)
    updates.needs_reorder = Boolean(updates.needs_reorder);

  // Convert expiration_date from MM/DD/YY display format → YYYY-MM-DD for Postgres
  if ('expiration_date' in updates)
    updates.expiration_date = toISODate(updates.expiration_date as string);

  // Title-case the name on every save
  if ('name' in updates && typeof updates.name === 'string' && updates.name.trim())
    updates.name = toTitleCase(updates.name as string);

  // PostgreSQL rejects empty strings for nullable columns — use null instead
  for (const field of ['location', 'notes', 'reorder_level', 'name']) {
    if (field in updates && updates[field] === '')
      updates[field] = null;
  }

  updates.updated_at = new Date().toISOString();

  const serverClient = createServerClient();
  const { data, error } = await serverClient
    .from('supplies')
    .update(updates)
    .eq('id', parseInt(id, 10))
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
