'use client';

import { useState } from 'react';

import { TextLink } from './text-link';

export function SignOut() {
  const [busy, setBusy] = useState(false);
  return (
    <TextLink
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch('/api/auth/sign-out/', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }).catch(() => {});
        location.assign('/login/');
      }}>
      {busy ? 'Signing out…' : 'Sign out'}
    </TextLink>
  );
}
