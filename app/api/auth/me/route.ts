import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const value = request.cookies.get('auth-session')?.value;

  let role: string | null = null;
  if (value === 'amg-admin' || value === 'amg-authenticated') role = 'admin';
  else if (value === 'amg-staff') role = 'staff';

  const res = role
    ? NextResponse.json({ role })
    : NextResponse.json({ role: null }, { status: 401 });

  // Never cache — role changes on every login/logout
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.headers.set('Pragma', 'no-cache');
  return res;
}
