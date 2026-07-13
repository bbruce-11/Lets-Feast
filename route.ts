import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://localhost:8080';
const COOKIE_NAME = 'feast_admin_token';

type Context = { params: { path: string[] } };

async function proxy(req: NextRequest, { params }: Context): Promise<NextResponse> {
  const token = cookies().get(COOKIE_NAME)?.value;
  const url = `${API_URL}/api/${params.path.join('/')}`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await req.text() : undefined;

  const upstream = await fetch(url, { method: req.method, headers, body });

  if (upstream.status === 204) return new NextResponse(null, { status: 204 });
  const data = await upstream.json().catch(() => null);
  return NextResponse.json(data, { status: upstream.status });
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };
