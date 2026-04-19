import { NextRequest, NextResponse } from 'next/server';
import { supabase, createServerClient, type Supply } from '@/lib/supabase';
import { toISODate } from '@/lib/dates';
import { toTitleCase } from '@/lib/strings';
import { getCategoryRequirements } from '@/lib/categoryRules';

function getCurrentUser(sessionValue: string | undefined) {
  if (sessionValue === 'amg-admin') return { user_id: 'admin', user_display_name: 'Admin' };
  if (sessionValue === 'amg-staff') return { user_id: 'staff', user_display_name: 'Staff' };
  return { user_id: 'unknown', user_display_name: 'Unknown' };
}

function enrich(items: Supply[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30Days  = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in90Days  = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

  return items.map((item) => {
    let isExpired     = false;
    let isUrgent      = false;   // < 30 days
    let isWarning     = false;   // 30 – 90 days
    let isHealthy     = false;   // > 90 days away

    if (item.expiration_date) {
      const exp = new Date(item.expiration_date);
      if (!isNaN(exp.getTime())) {
        if      (exp <  today)    isExpired = true;
        else if (exp <= in30Days) isUrgent  = true;
        else if (exp <= in90Days) isWarning = true;
        else                      isHealthy = true;
      }
    }

    // keep isExpiringSoon for dashboard compatibility
    return { ...item, isExpired, isUrgent, isWarning, isHealthy, isExpiringSoon: isUrgent || isWarning };
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search       = searchParams.get('search') || '';
  const category     = searchParams.get('category') || '';
  const needsReorder = searchParams.get('needs_reorder');
  const onlyExpired   = searchParams.get('expired');
  const onlyExpiring  = searchParams.get('expiring');
  const showArchived = searchParams.get('archived') === '1';

  const SORTABLE = ['inventory_id', 'name', 'category', 'quantity', 'location', 'expiration_date'];
  const rawSort  = searchParams.get('sort') || 'expiration_date';
  const sortCol  = SORTABLE.includes(rawSort) ? rawSort : 'expiration_date';
  const ascending = searchParams.get('dir') !== 'desc';

  let query = showArchived
    ? supabase.from('supplies').select('*').eq('is_archived', true)
        .order(sortCol, { ascending, nullsFirst: false })
    : supabase.from('supplies').select('*').or('is_archived.eq.false,is_archived.is.null')
        .order(sortCol, { ascending, nullsFirst: false });

  if (category)             query = query.eq('category', category);
  if (needsReorder === '1') query = query.eq('needs_reorder', true);
  if (search)               query = query.or(
    `name.ilike.%${search}%,inventory_id.ilike.%${search}%,notes.ilike.%${search}%,category.ilike.%${search}%,location.ilike.%${search}%,lot_number.ilike.%${search}%`
  );

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let enriched = enrich((data ?? []) as Supply[]);

  if (onlyExpired === '1')
    enriched = enriched.filter((i) => i.isExpired);
  if (onlyExpiring === '1')
    enriched = enriched.filter((i) => i.isUrgent || i.isWarning);

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.name?.trim())
    return NextResponse.json({ error: 'Item name is required' }, { status: 400 });

  const newItem = {
    name: toTitleCase(body.name.trim()),
    category: body.category || 'Uncategorized',
    quantity: body.quantity || '0',
    reorder_level: body.reorder_level || '0',
    manufacturer: body.manufacturer?.trim() ? toTitleCase(body.manufacturer.trim()) : null,
    ref_sku: body.ref_sku?.trim() || null,
    barcode: body.barcode?.trim() || null,
    location: body.location || null,
    no_expiration: body.no_expiration === true || body.no_expiration === 'true',
    expiration_date: body.no_expiration ? null : body.expiration_date?.trim() ? toISODate(body.expiration_date) : null,
    lot_unknown: body.lot_unknown === true || body.lot_unknown === 'true',
    lot_number: body.lot_unknown ? null : body.lot_number?.trim() || null,
    is_archived: false,
  };

  const req = getCategoryRequirements(newItem.category);

  if (req.requiresExpiration && !newItem.no_expiration && !newItem.expiration_date) {
    return NextResponse.json(
      { error: 'Required for this category', field: 'expiration_date' },
      { status: 400 }
    );
  }

  if (req.requiresLot && !newItem.lot_unknown && !newItem.lot_number) {
    return NextResponse.json(
      { error: 'Required for this category', field: 'lot_number' },
      { status: 400 }
    );
  }

  if (newItem.expiration_date && isNaN(Date.parse(String(newItem.expiration_date)))) {
    return NextResponse.json(
      { error: 'Expiration date must be a valid date (YYYY-MM-DD).', field: 'expiration_date' },
      { status: 400 }
    );
  }

  const serverClient = createServerClient();
  const { data, error } = await serverClient.from('supplies').insert([newItem]).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (data) {
    await serverClient.from('supply_lot_entries').insert({
      item_id: data.id,
      lot_number: newItem.lot_number,
      quantity: newItem.quantity,
      expiration_date: newItem.expiration_date,
      lot_unknown: newItem.lot_unknown,
      created_at: new Date().toISOString(),
    });

    const sessionValue = request.cookies.get('auth-session')?.value;
    const user = getCurrentUser(sessionValue);
    await serverClient.from('supply_audit_log').insert({
      item_id: data.id,
      user_id: user.user_id,
      user_display_name: user.user_display_name,
      change_type: 'create',
      field_name: 'item',
      old_value: null,
      new_value: JSON.stringify(newItem),
      created_at: new Date().toISOString(),
    });
  }

  return NextResponse.json(data, { status: 201 });
}
