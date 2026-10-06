import { cookies } from 'next/headers';

import { ROLE_COOKIE, roleFromCookie } from '../../../lib/demo';

/** The role switcher: sets the cookie the demo's `identify` reads, then reloads. */
export async function POST(request: Request) {
  const form = await request.formData();
  const role = roleFromCookie(String(form.get('role')));
  const jar = await cookies();
  if (role === 'visitor') jar.delete({ name: ROLE_COOKIE, path: '/demo' });
  else
    jar.set(ROLE_COOKIE, role, {
      path: '/demo',
      sameSite: 'lax',
      httpOnly: true,
    });

  // Back where the switch was pressed, and only ever within the demo.
  const referer = request.headers.get('referer');
  const demoRoot = `${new URL(request.url).origin}/demo/`;
  const back = referer?.startsWith(demoRoot) ? referer : '/demo/';
  // A full reload lands at the top; on the overview, return to the switcher.
  const location =
    new URL(back, demoRoot).pathname === '/demo/'
      ? `${back.split('#')[0]}#who`
      : back;
  return new Response(null, { status: 303, headers: { location } });
}
