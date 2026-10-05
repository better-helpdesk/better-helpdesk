import { WALL, WALL_ME } from '../../lib/content';
import { Ident, Mark } from './mark';

// A 4×4 Bayer matrix: faces arrive in dither order rather than row by row.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export function Wall() {
  return (
    <div className="wall-w">
      <div
        className="wall"
        role="img"
        aria-label="A wall of customer faces; the smiling one is waiting for a reply">
        {WALL.map((name, i) => {
          const x = i % 7;
          const y = Math.floor(i / 7);
          const order = (BAYER[(x % 4) + 4 * (y % 4)] ?? 0) + (x >= 4 ? 16 : 0);
          const me = i === WALL_ME;
          return (
            <div
              key={name}
              className={me ? 'tile me' : 'tile'}
              data-name={me ? 'Mira Okafor · waiting 4m' : name}
              style={{ animationDelay: `${300 + order * 28}ms` }}>
              {me ? (
                <Mark fg="var(--bg)" bg="var(--mint)" />
              ) : (
                <Ident name={name} fg="var(--fg)" bg="var(--s2)" />
              )}
            </div>
          );
        })}
      </div>
      <div className="wall-cap">
        <span>
          <b>■</b> Mira Okafor is waiting · ACME-1042
        </span>
        <span className="wall-hint">hover a face</span>
      </div>
    </div>
  );
}
