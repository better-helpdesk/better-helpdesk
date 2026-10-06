'use client';

import { HelpdeskWidget } from 'better-helpdesk/widget';
import { usePathname } from 'next/navigation';

import { LauncherSkin } from './launcher-skin';

/** The site's own launcher, everywhere but /demo, which brings Harbor's. */
export function SiteWidget({ api }: { api: string }) {
  if (usePathname().startsWith('/demo')) return null;
  return (
    <>
      <HelpdeskWidget api={api} inbox="support" locale="en" />
      <LauncherSkin />
    </>
  );
}
