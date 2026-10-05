import { HelpdeskWidget } from 'better-helpdesk/widget';
import type { Metadata, Viewport } from 'next';
import { Doto, Martian_Mono, Rethink_Sans } from 'next/font/google';

import { API } from '../lib/helpdesk';
import { LauncherSkin } from './components/launcher-skin';
import './site.css';

const doto = Doto({
  subsets: ['latin'],
  variable: '--font-doto',
  weight: ['800', '900'],
});
const rethink = Rethink_Sans({
  subsets: ['latin'],
  variable: '--font-rethink',
});
const martian = Martian_Mono({
  subsets: ['latin'],
  variable: '--font-martian',
});

const description =
  'An open-source support inbox, ticketing and lightweight CRM you install from npm. It runs in your Next.js app, on your Postgres, behind your login.';

// Fixed rather than SITE_URL: the build has no environment, and reading it per
// request would make every page dynamic and uncacheable.
export const metadata: Metadata = {
  metadataBase: new URL('https://better-helpdesk.com'),
  title: {
    default: 'Better Helpdesk: the open-source helpdesk for Next.js',
    template: '%s · Better Helpdesk',
  },
  description,
  openGraph: {
    title: 'Better Helpdesk: the open-source helpdesk for Next.js',
    description,
    type: 'website',
    siteName: 'Better Helpdesk',
  },
  twitter: { card: 'summary_large_image' },
};

// Static pages would otherwise tell a CDN to keep them for a year, past any deploy.
export const revalidate = 300;

export const viewport: Viewport = {
  themeColor: '#0b0d0c',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Browser extensions write styles onto <html> before React hydrates.
    <html
      lang="en"
      className={`${doto.variable} ${rethink.variable} ${martian.variable}`}
      suppressHydrationWarning>
      <body>
        {children}
        <HelpdeskWidget api={API} inbox="support" locale="en" />
        <LauncherSkin />
      </body>
    </html>
  );
}
