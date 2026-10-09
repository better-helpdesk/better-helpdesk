import { cookies } from 'next/headers';

import { type DemoRole, ROLE_COOKIE, roleFromCookie } from '../../../lib/demo';

export const currentRole = async (): Promise<DemoRole> =>
  roleFromCookie((await cookies()).get(ROLE_COOKIE)?.value);

const ROLES = [
  {
    id: 'visitor',
    label: 'Visitor',
    note: 'Nobody is signed in. The widget asks for an email; any made-up one works.',
  },
  {
    id: 'customer',
    label: 'Nadia, customer',
    note: 'Signed in, so the widget knows her. What you write as her stays yours.',
  },
  {
    id: 'agent',
    label: 'Rowan, agent',
    note: 'Answers from the inbox and sees every conversation.',
  },
] as const satisfies readonly { id: DemoRole; label: string; note: string }[];

/**
 * A plain form POST, so the whole page reloads: the widget has already read
 * its session, and a soft navigation would leave it showing the old identity.
 */
export function RoleSwitcher({ role }: { role: DemoRole }) {
  return (
    <form className="demo-roles" method="post" action="/demo/role/">
      {ROLES.map(option => (
        <button
          key={option.id}
          type="submit"
          name="role"
          value={option.id}
          className="demo-role"
          aria-pressed={role === option.id}>
          <b>{option.label}</b>
          <span>{option.note}</span>
        </button>
      ))}
    </form>
  );
}
