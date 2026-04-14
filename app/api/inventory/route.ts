import { NextRequest, NextResponse } from 'next/server';
import { supabase, createServerClient, type Supply } from '@/lib/supabase';
import { toISODate } from '@/lib/dates';
import { toTitleCase } from '@/lib/strings';

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
    expiration_date: body.expiration_date?.trim() ? toISODate(body.expiration_date) : null,
    is_archived: false,
  };

  const serverClient = createServerClient();
  const { data, error } = await serverClient.from('supplies').insert([newItem]).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
