import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(`${origin}/login`, { status: 303 });
  response.cookies.set('auth-session', '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   0,
    path:     '/',
  });
  return response;
}
