import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

const MINT = '#9ad9b8';
const MARK =
  'M1.5 .5h1v2h-1zM3.5 .5h1v2h-1zM.5 3.5h1v1h-1zM4.5 3.5h1v1h-1zM1.5 4.5h3v1h-3z';
const HEAD = ['YOUR HELPDESK,', 'INSIDE', 'YOUR APP.'];
const INSTALL = '$ npm install better-helpdesk';
const META = 'Open source · MIT · Your database';

/** The site's faces from Google Fonts as TTF, which next/og reads and woff2 it does not; next/font fetches them at build too. */
async function font(family: string, weight: number, text: string) {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&text=${encodeURIComponent(text)}`
  ).then(r => r.text());
  const url = css.match(
    /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/
  )?.[1];
  if (!url) throw new Error(`No TTF for ${family} ${weight}`);
  return fetch(url).then(r => r.arrayBuffer());
}

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
          data: await font('Doto', 900, HEAD.join('')),
          weight: 900,
        },
        {
          name: 'Rethink Sans',
          data: await font('Rethink Sans', 700, 'Better Helpdesk'),
          weight: 700,
        },
        {
          name: 'Rethink Sans',
          data: await font('Rethink Sans', 400, META),
          weight: 400,
        },
        {
          name: 'Martian Mono',
          data: await font('Martian Mono', 400, INSTALL),
          weight: 400,
        },
      ],
    }
  );
}
