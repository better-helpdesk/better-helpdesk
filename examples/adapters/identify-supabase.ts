// Supabase Auth in the App Router; `createClient` is the server client from
// Supabase's Next.js setup. Supabase has no organizations, so they come from
// your own tables, here `memberships` joined to `orgs`.
import type { Identity } from 'better-helpdesk';

import { createClient } from '@/lib/supabase/server';

export async function identify(): Promise<Identity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: memberships, error } = await supabase
    .from('memberships')
    .select('org:orgs(id, name)')
    .eq('user_id', user.id)
    .eq('status', 'active');
  if (error) throw error;
  return {
    user: {
      id: user.id,
      email: user.email,
      // Only while "Confirm email" is on in your project: with it off, Supabase
      // sets this at sign-up without proof.
      emailVerified: Boolean(user.email_confirmed_at),
      name: user.user_metadata.full_name,
      image: user.user_metadata.avatar_url,
    },
    orgs: (memberships ?? []).flatMap(row => row.org ?? []),
    // `user_metadata` is editable by the user, so the flag lives in
    // `app_metadata`, which only the Admin API writes.
    isAgent: user.app_metadata.support === true,
  };
}
