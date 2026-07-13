import { NextRequest, NextResponse } from 'next/server';

// SECURITY NOTE: this middleware only base64-decodes the JWT payload — it does
// NOT verify the signature. That's acceptable here because it's UI routing
// only (which page shell to render); every actual data fetch goes through the
// NestJS API's JwtAuthGuard, which does verify the signature, plus RolesGuard,
// which re-checks the role from the DB. Do not treat this file as a security
// boundary, and do not add any data access here without going through the API.

const COOKIE_NAME = 'feast_admin_token';

function getJwtRole(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(padded);
    const { role } = JSON.parse(decoded) as { role?: string };
    return role ?? null;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;

  const isLoginPath = pathname.startsWith('/login');

  if (isLoginPath) {
    if (token && getJwtRole(token) === 'admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const role = getJwtRole(token);
  if (role !== 'admin') {
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|rpc/).*)'],
};
