import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('supplies')
    .select('expiration_date, needs_reorder')
    .or('is_archived.eq.false,is_archived.is.null');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const today = new Date();
  const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  let needsReorder = 0, expired = 0, expiringSoon = 0;

  for (const item of data ?? []) {
    if (item.needs_reorder) needsReorder++;
    if (item.expiration_date) {
      const exp = new Date(item.expiration_date);
      if (!isNaN(exp.getTime())) {
        if (exp < today) expired++;
        else if (exp <= in90Days) expiringSoon++;
      }
    }
  }

  return NextResponse.json({
    total: data?.length ?? 0,
    needsReorder,
    expired,
    expiringSoon,
  });
}
