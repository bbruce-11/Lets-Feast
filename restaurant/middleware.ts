import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'feast_staff_token';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;

  const isLoginPath = pathname.startsWith('/login');

  if (isLoginPath && token) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  if (!isLoginPath && !token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|rpc/).*)'],
};
