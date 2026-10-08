// Clerk in the App Router. `currentUser()` reads the session Next.js is
// handling, so `identify` takes no argument; the memberships come from the
// Backend API, which lists only accepted ones.
import { clerkClient, currentUser } from '@clerk/nextjs/server';
import type { Identity } from 'better-helpdesk';

export async function identify(): Promise<Identity | null> {
  const user = await currentUser();
  if (!user) return null;
  const client = await clerkClient();
  const { data: memberships } =
    await client.users.getOrganizationMembershipList({
      userId: user.id,
      limit: 100,
    });
  const primary = user.emailAddresses.find(
    address => address.id === user.primaryEmailAddressId
  );
  return {
    user: {
      id: user.id,
      email: primary?.emailAddress,
      emailVerified: primary?.verification?.status === 'verified',
      name: user.fullName,
      image: user.imageUrl,
      locale: user.locale,
    },
    orgs: memberships.map(membership => ({
      id: membership.organization.id,
      name: membership.organization.name,
    })),
    // Set `{ "support": true }` in the user's public metadata, in the Clerk
    // dashboard or through the Backend API.
    isAgent: user.publicMetadata.support === true,
  };
}
