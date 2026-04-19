import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { toISODate } from '@/lib/dates';
import { toTitleCase } from '@/lib/strings';

const ALLOWED = ['name', 'quantity', 'reorder_level', 'expiration_date', 'location', 'notes', 'needs_reorder', 'category', 'lot_number', 'ref_sku', 'manufacturer', 'barcode', 'is_archived'];

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

  // Coerce boolean fields
  if ('needs_reorder' in updates)
    updates.needs_reorder = Boolean(updates.needs_reorder);
  if ('is_archived' in updates)
    updates.is_archived = Boolean(updates.is_archived);

  // Convert expiration_date from MM/DD/YY display format → YYYY-MM-DD for Postgres
  if ('expiration_date' in updates)
    updates.expiration_date = toISODate(updates.expiration_date as string);

  // Title-case the name and manufacturer on every save
  if ('name' in updates && typeof updates.name === 'string' && updates.name.trim())
    updates.name = toTitleCase(updates.name as string);
  if ('manufacturer' in updates && typeof updates.manufacturer === 'string' && updates.manufacturer.trim())
    updates.manufacturer = toTitleCase(updates.manufacturer as string);

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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const serverClient = createServerClient();
  const { error } = await serverClient
    .from('supplies')
    .delete()
    .eq('id', parseInt(id, 10));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
