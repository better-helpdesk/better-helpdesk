import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

const MINT = '#9ad9b8';
const MARK =
  'M1.5 .5h1v2h-1zM3.5 .5h1v2h-1zM.5 3.5h1v1h-1zM4.5 3.5h1v1h-1zM1.5 4.5h3v1h-3z';
const HEAD = ['YOUR HELPDESK,', 'INSIDE', 'YOUR APP.'];
const INSTALL = '$ npm install better-helpdesk';
const META = 'Open source · MIT · Your database';

/**
 * The card's faces, subset to the text it draws, as TTF (next/og reads TTF, not woff2).
 * They ship in the repository so the build needs no network. They are Google Fonts'
 * subsets for exactly this text: change the text, fetch them again.
 */
const font = (file: string) =>
  readFile(join(process.cwd(), 'app/og.png/fonts', file));

/** The social card for the site and the repository, in the hero's type: Doto headline, Martian Mono install line, Rethink Sans meta. */
export async function GET() {
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6 6" shape-rendering="crispEdges"><rect width="6" height="6" fill="${MINT}"/><path fill="#0b0d0c" d="${MARK}"/></svg>`
  );
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: '#0b0d0c',
        color: '#eef3f0',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* biome-ignore lint/performance/noImgElement: next/og renders plain img only */}
        <img alt="" src={`data:image/svg+xml,${svg}`} width={56} height={56} />
        <div
          style={{ fontFamily: 'Rethink Sans', fontSize: 30, fontWeight: 700 }}>
          Better Helpdesk
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Doto',
          fontSize: 104,
          lineHeight: 0.9,
          letterSpacing: '-0.01em',
        }}>
        <div>{HEAD[0]}</div>
        <div style={{ color: MINT }}>{HEAD[1]}</div>
        <div>{HEAD[2]}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <div
          style={{
            fontFamily: 'Martian Mono',
            fontSize: 24,
            padding: '14px 20px',
            border: '1px solid rgba(210, 240, 225, 0.15)',
            background: '#111413',
          }}>
          {INSTALL}
        </div>
        <div
          style={{
            fontFamily: 'Rethink Sans',
            fontSize: 24,
            color: '#a7b1ab',
          }}>
          {META}
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Doto',
          data: await font('doto-900.ttf'),
          weight: 900,
        },
        {
          name: 'Rethink Sans',
          data: await font('rethink-sans-700.ttf'),
          weight: 700,
        },
        {
          name: 'Rethink Sans',
          data: await font('rethink-sans-400.ttf'),
          weight: 400,
        },
        {
          name: 'Martian Mono',
          data: await font('martian-mono-400.ttf'),
          weight: 400,
        },
      ],
    }
  );
}
