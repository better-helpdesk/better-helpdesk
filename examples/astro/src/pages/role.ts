import type { APIRoute } from 'astro';

import { ROLE_COOKIE } from '../lib/helpdesk';

/** The sign-in button: sets or clears the cookie `identify` reads, then goes back. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  if (form.get('role') === 'agent') {
    cookies.set(ROLE_COOKIE, 'agent', { path: '/', sameSite: 'lax' });
  } else {
    cookies.delete(ROLE_COOKIE, { path: '/' });
  }
  return redirect('/', 303);
};
