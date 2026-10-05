// Auth.js (NextAuth v5) in the App Router. It has no organisations, so they
// and the agent flag come from your own tables.
import type { Identity } from 'better-helpdesk';

import { auth } from '@/auth';
import { isSupportStaff, membershipsOf } from '@/lib/members';

export async function identify(): Promise<Identity | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;
  return {
    // Only if every provider you enable proves the address, as email links do.
    user: {
      id: user.id,
      email: user.email,
      emailVerified: true,
      name: user.name,
    },
    orgs: await membershipsOf(user.id), // [{ id, name }], active only
    isAgent: await isSupportStaff(user.id),
  };
}
