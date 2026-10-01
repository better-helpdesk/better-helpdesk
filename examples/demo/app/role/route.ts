import { cookies } from 'next/headers';

import { ROLE_COOKIE, roleFromCookie } from '../../lib/role';

/** The role switcher: sets the cookie the demo's `identify` reads, then reloads. */
export async function POST(request: Request) {
  const form = await request.formData();
  const role = roleFromCookie(String(form.get('role')));
  const jar = await cookies();
  if (role === 'visitor') jar.delete(ROLE_COOKIE);
  else jar.set(ROLE_COOKIE, role, { path: '/', sameSite: 'lax' });

  // Back where the switch was pressed, and only ever to this app.
  const referer = request.headers.get('referer');
  const here = new URL(request.url).origin;
  const back = referer?.startsWith(`${here}/`) ? referer : '/';
  return new Response(null, { status: 303, headers: { location: back } });
}
