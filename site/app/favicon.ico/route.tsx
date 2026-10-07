import { iconImage } from '../icon-image';

export const dynamic = 'force-static';

/** Browsers and crawlers ask for /favicon.ico whatever the page links; a PNG under that name is accepted. */
export function GET() {
  return iconImage(48);
}
