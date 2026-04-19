import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { toISODate } from '@/lib/dates';
import { toTitleCase } from '@/lib/strings';
import { getCategoryRequirements } from '@/lib/categoryRules';

const ALLOWED = ['name', 'quantity', 'reorder_level', 'expiration_date', 'location', 'notes', 'needs_reorder', 'category', 'lot_number', 'lot_unknown', 'no_expiration', 'ref_sku', 'manufacturer', 'barcode', 'is_archived'];

function getCurrentUser(sessionValue: string | undefined) {
  if (sessionValue === 'amg-admin') return { user_id: 'admin', user_display_name: 'Admin' };
  if (sessionValue === 'amg-staff') return { user_id: 'staff', user_display_name: 'Staff' };
  return { user_id: 'unknown', user_display_name: 'Unknown' };
}

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
  if ('lot_unknown' in updates)
    updates.lot_unknown = Boolean(updates.lot_unknown);
  if ('no_expiration' in updates)
    updates.no_expiration = Boolean(updates.no_expiration);

  // Convert expiration_date from MM/DD/YY display format → YYYY-MM-DD for Postgres
  if ('expiration_date' in updates)
    updates.expiration_date = toISODate(updates.expiration_date as string);
  if (updates.no_expiration)
    updates.expiration_date = null;
  if (updates.lot_unknown)
    updates.lot_number = null;

  // Title-case the name and manufacturer on every save
  if ('name' in updates && typeof updates.name === 'string' && updates.name.trim())
    updates.name = toTitleCase(updates.name as string);
  if ('manufacturer' in updates && typeof updates.manufacturer === 'string' && updates.manufacturer.trim())
    updates.manufacturer = toTitleCase(updates.manufacturer as string);

  // PostgreSQL rejects empty strings for nullable columns — use null instead
  for (const field of ['location', 'notes', 'reorder_level', 'name', 'lot_number']) {
    if (field in updates && updates[field] === '')
      updates[field] = null;
  }

  updates.updated_at = new Date().toISOString();

  const serverClient = createServerClient();
  const { data: existing, error: fetchError } = await serverClient
    .from('supplies')
    .select('*')
    .eq('id', parseInt(id, 10))
    .single();

  if (fetchError || !existing)
    return NextResponse.json({ error: 'Item not found.' }, { status: 404 });

  const effectiveCategory = (updates.category ?? existing.category) as string | null | undefined;
  const req = getCategoryRequirements(effectiveCategory);

  const effectiveNoExpiration = Boolean(updates.no_expiration ?? existing.no_expiration);
  const effectiveLotUnknown = Boolean(updates.lot_unknown ?? existing.lot_unknown);

  const effectiveExpirationDate = (updates.expiration_date ?? existing.expiration_date) as string | null | undefined;
  const effectiveLotNumber = (updates.lot_number ?? existing.lot_number) as string | null | undefined;

  if (req.requiresExpiration && !effectiveNoExpiration && !effectiveExpirationDate) {
    return NextResponse.json(
      { error: 'Required for this category', field: 'expiration_date' },
      { status: 400 }
    );
  }

  if (req.requiresLot && !effectiveLotUnknown && !effectiveLotNumber) {
    return NextResponse.json(
      { error: 'Required for this category', field: 'lot_number' },
      { status: 400 }
    );
  }

  const { data, error } = await serverClient
    .from('supplies')
    .update(updates)
    .eq('id', parseInt(id, 10))
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sessionValue = request.cookies.get('auth-session')?.value;
  const user = getCurrentUser(sessionValue);
  const auditEntries = Object.entries(updates)
    .filter(([field, value]) => String(existing[field as keyof typeof existing] ?? '') !== String(value ?? ''))
    .map(([field, value]) => ({
      item_id: parseInt(id, 10),
      user_id: user.user_id,
      user_display_name: user.user_display_name,
      change_type: 'update',
      field_name: field,
      old_value: existing[field as keyof typeof existing] == null ? null : String(existing[field as keyof typeof existing]),
      new_value: value == null ? null : String(value),
      created_at: new Date().toISOString(),
    }));

  if (auditEntries.length > 0) {
    await serverClient.from('supply_audit_log').insert(auditEntries);
  }

  const lotFieldsChanged = ['lot_number', 'lot_unknown', 'expiration_date', 'quantity'].some((field) => field in updates);
  if (lotFieldsChanged && data) {
    await serverClient.from('supply_lot_entries').insert({
      item_id: data.id,
      lot_number: data.lot_number,
      quantity: data.quantity,
      expiration_date: data.expiration_date,
      lot_unknown: data.lot_unknown,
      created_at: new Date().toISOString(),
    });
  }

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
