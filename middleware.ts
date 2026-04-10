import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'auth-session';

function getRole(value: string | undefined): 'admin' | 'staff' | null {
  if (value === 'amg-admin' || value === 'amg-authenticated') return 'admin';
  if (value === 'amg-staff') return 'staff';
  return null;
}

/** Routes that require any login */
function isProtected(pathname: string) {
  return pathname === '/' || pathname.startsWith('/inventory');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtected(pathname)) return NextResponse.next();

  const session = request.cookies.get(SESSION_COOKIE);
  const role = getRole(session?.value);

  // Not logged in — redirect to login
  if (!role) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|api/auth).*)'],
};
