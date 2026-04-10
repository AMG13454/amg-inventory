import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SESSION_COOKIE = 'auth-session';
const THIRTY_DAYS    = 60 * 60 * 24 * 30;

function setCookie(response: NextResponse, value: string) {
  response.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   THIRTY_DAYS,
    path:     '/',
  });
}

export async function POST(request: NextRequest) {
  const { password, role } = await request.json();

  if (role === 'staff') {
    if (!process.env.STAFF_PIN || password !== process.env.STAFF_PIN) {
      return NextResponse.json({ error: 'Incorrect PIN.' }, { status: 401 });
    }
    const response = NextResponse.json({ success: true, role: 'staff' });
    setCookie(response, 'amg-staff');
    return response;
  }

  // Default: manager login
  if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }
  const response = NextResponse.json({ success: true, role: 'admin' });
  setCookie(response, 'amg-admin');
  return response;
}
