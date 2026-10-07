import type { Metadata, Viewport } from 'next';

import { API } from '../../lib/helpdesk';
import { DESCRIPTION, ORIGIN, SITE_NAME } from '../../lib/seo';
import { fontClasses } from '../fonts';
import { SiteWidget } from './components/site-widget';
import './site.css';

const description = DESCRIPTION;

export const metadata: Metadata = {
  metadataBase: new URL(ORIGIN),
  title: {
    default: 'Better Helpdesk: the open-source helpdesk for Next.js',
    template: '%s · Better Helpdesk',
  },
  description,
  openGraph: {
    title: 'Better Helpdesk: the open-source helpdesk for Next.js',
    description,
    type: 'website',
    siteName: SITE_NAME,
    images: ['/og.png'],
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
    <html lang="en" className={fontClasses} suppressHydrationWarning>
      <body>
        {children}
        <SiteWidget api={API} />
      </body>
    </html>
  );
}
