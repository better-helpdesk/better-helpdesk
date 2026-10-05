import { HelpdeskWidget } from 'better-helpdesk/widget';
import type { Metadata, Viewport } from 'next';
import { Doto, Martian_Mono, Rethink_Sans } from 'next/font/google';
import { connection } from 'next/server';

import { API, siteUrl } from '../lib/helpdesk';
import { LauncherSkin } from './components/launcher-skin';
import './site.css';

const doto = Doto({
  subsets: ['latin'],
  variable: '--font-doto',
  weight: ['700', '800', '900'],
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
  'An open-source support inbox, ticketing and CRM you install from npm. It runs in your Next.js app, on your Postgres, behind your login.';

// SITE_URL is only known at runtime on Divio, so metadata is built per request.
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: 'Better Helpdesk', template: '%s · Better Helpdesk' },
    description,
    openGraph: {
      title: 'Better Helpdesk',
      description,
      type: 'website',
      siteName: 'Better Helpdesk',
    },
    twitter: { card: 'summary_large_image' },
  };
}

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
    <html
      lang="en"
      className={`${doto.variable} ${rethink.variable} ${martian.variable}`}>
      <body>
        {children}
        <HelpdeskWidget api={API} inbox="support" locale="en" />
        <LauncherSkin />
      </body>
    </html>
  );
}
