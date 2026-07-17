'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE_NAME = 'feast_restaurant_token';
const API_URL = process.env.API_URL ?? 'http://localhost:8080';

export async function loginAction(passcode: string): Promise<{ error: string } | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/staff-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Record<string, string>;
      return { error: body.message ?? 'Invalid passcode' };
    }
    const { token } = (await res.json()) as { token: string };
    (await cookies()).set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 12,
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
