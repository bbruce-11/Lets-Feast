'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE_NAME = 'feast_admin_token';
const API_URL = process.env.API_URL ?? 'http://localhost:8080';

export async function loginAction(
  email: string,
  password: string,
): Promise<{ error: string } | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Record<string, string>;
      return { error: body.message ?? 'Invalid credentials' };
    }
    const { token } = (await res.json()) as { token: string };
    (await cookies()).set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
  } catch {
    return { error: 'Unable to connect to the server. Please try again.' };
  }
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
  redirect('/login');
}
