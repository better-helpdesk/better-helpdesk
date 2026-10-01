import { cookies } from 'next/headers';

export const ROLE_COOKIE = 'demo-role';

export type DemoRole = 'visitor' | 'customer' | 'agent';

export const ROLES = [
  {
    id: 'visitor',
    label: 'Visitor',
    note: 'Nobody is signed in. The widget asks for an email before the first message.',
  },
  {
    id: 'customer',
    label: 'Nadia, customer',
    note: 'Signed in at Brightline Logistics. Her conversations follow her around.',
  },
  {
    id: 'agent',
    label: 'Rowan, agent',
    note: 'Answers from the inbox at /helpdesk, and can see every conversation.',
  },
] as const satisfies readonly { id: DemoRole; label: string; note: string }[];

export const roleFromCookie = (value: string | undefined): DemoRole =>
  value === 'customer' || value === 'agent' ? value : 'visitor';

export const currentRole = async (): Promise<DemoRole> =>
  roleFromCookie((await cookies()).get(ROLE_COOKIE)?.value);
