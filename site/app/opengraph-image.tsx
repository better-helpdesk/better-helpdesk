import { ImageResponse } from 'next/og';

export const alt =
  'Better Helpdesk: the helpdesk that lives inside your Next.js app';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// The mark's cells, on the same 5×5 grid as app/icon.svg.
const CELLS = [
  [1, 0],
  [1, 1],
  [3, 0],
  [3, 1],
  [0, 3],
  [4, 3],
  [1, 4],
  [2, 4],
  [3, 4],
];

export default function Image() {
  const cell = 44;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 80,
        background: '#0b0d0c',
        color: '#eef3f0',
      }}>
      <div
        style={{
          display: 'flex',
          position: 'relative',
          width: cell * 6,
          height: cell * 6,
          background: '#9ad9b8',
        }}>
        {CELLS.map(([x = 0, y = 0]) => (
          <div
            key={`${x}-${y}`}
            style={{
              position: 'absolute',
              left: (x + 0.5) * cell,
              top: (y + 0.5) * cell,
              width: cell,
              height: cell,
              background: '#0b0d0c',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: -2,
            lineHeight: 1,
          }}>
          The helpdesk that lives inside your Next.js app.
        </div>
        <div style={{ fontSize: 32, color: '#a7b1ab' }}>
          Better Helpdesk · open source · MIT · npm install better-helpdesk
        </div>
      </div>
    </div>,
    size
  );
}
