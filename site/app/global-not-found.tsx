import type { Metadata } from 'next';

import NotFound from './(site)/not-found';
import { fontClasses } from './fonts';
import './(site)/site.css';
import { ORIGIN } from '../lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(ORIGIN),
  title: 'Not found · Better Helpdesk',
};

/** For a URL no route matches, which the site's and the docs' own root layouts never see. */
export default function GlobalNotFound() {
  return (
    <html lang="en" className={fontClasses}>
      <body>
        <NotFound />
      </body>
    </html>
  );
}
