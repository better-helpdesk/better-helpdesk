import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { API } from '../../lib/helpdesk';
import { source } from '../../lib/source';
import { LiveMark } from '../(site)/components/live-mark';
import { SiteWidget } from '../(site)/components/site-widget';
import { fontClasses } from '../fonts';
import './docs.css';
import { ORIGIN } from '../../lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(ORIGIN),
  title: {
    default: 'Docs · Better Helpdesk',
    template: '%s · Better Helpdesk docs',
  },
};

export const revalidate = 300;

export const viewport: Viewport = {
  themeColor: '#0b0d0c',
  colorScheme: 'dark',
};

/** Its own root layout, so Tailwind and the docs' styles never reach the marketing pages. */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`dark ${fontClasses}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider
          theme={{
            forcedTheme: 'dark',
            defaultTheme: 'dark',
            enableSystem: false,
          }}>
          <DocsLayout
            tree={source.getPageTree()}
            nav={{
              title: (
                <span className="docs-brand">
                  <span className="docs-brand-mark" aria-hidden="true">
                    <LiveMark fg="#fff" bg="#000" />
                  </span>
                  Better Helpdesk
                </span>
              ),
              url: '/',
            }}
            links={[
              { text: 'Live demo', url: '/demo/' },
              {
                text: 'GitHub',
                url: 'https://github.com/better-helpdesk/better-helpdesk',
                external: true,
              },
            ]}
            themeSwitch={{ enabled: false }}>
            {children}
          </DocsLayout>
        </RootProvider>
        <SiteWidget api={API} />
      </body>
    </html>
  );
}
