import { cookies } from 'next/headers';

export const ROLE_COOKIE = 'demo-role';

export type DemoRole =
  | 'visitor'
  | 'customer'
  | 'platinum'
  | 'agent'
  | 'supervisor'
  | 'viewer';

export const ROLES = [
  {
    id: 'visitor',
    label: 'Visitor',
    note: 'Nobody is signed in. The widget asks for an email before the first message.',
  },
  {
    id: 'customer',
    label: 'Nadia, standard support',
    note: 'Signed in at Brightline Logistics on standard support: no tier, best-effort targets, no priority to pick.',
  },
  {
    id: 'platinum',
    label: 'Jonas, premium support',
    note: 'Signed in at Nordkai Shipping on premium support: picks P1 to P3 and gets the tightest targets.',
  },
  {
    id: 'agent',
    label: 'Rowan, agent',
    note: 'Answers from the inbox at /helpdesk, and can see every conversation.',
  },
  {
    id: 'supervisor',
    label: 'Mina, supervisor',
    note: 'Works the inbox too, gets every SLA notice, and alone changes Settings and the team.',
  },
  {
    id: 'viewer',
    label: 'Theo, read-only',
    note: 'Sees the whole inbox and can change nothing.',
  },
] as const satisfies readonly { id: DemoRole; label: string; note: string }[];

const KNOWN = new Set<string>(ROLES.map(r => r.id));

export const roleFromCookie = (value: string | undefined): DemoRole =>
  value && KNOWN.has(value) ? (value as DemoRole) : 'visitor';

/** Roles that open the agent inbox. */
export const STAFF: readonly DemoRole[] = ['agent', 'supervisor', 'viewer'];

export const currentRole = async (): Promise<DemoRole> =>
  roleFromCookie((await cookies()).get(ROLE_COOKIE)?.value);
