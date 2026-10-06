// Better Auth with its organization and admin plugins; `auth` is your instance.
import type { Identity } from 'better-helpdesk';

import { auth } from '@/lib/auth';

export async function identify(request: Request): Promise<Identity | null> {
  const { headers } = request;
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const orgs = await auth.api.listOrganizations({ headers });
  const { user } = session;
  return {
    user: {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name,
      image: user.image,
    },
    orgs: orgs.map(org => ({ id: org.id, name: org.name })),
    isAgent: user.role?.split(',').includes('support') ?? false,
  };
}
