// The mark is built like a GitHub identicon: a mirrored 5×5 grid with half a
// cell of padding, so one cell is one unit of a 6×6 viewBox.
const EYES = 'M1.5 .5h1v2h-1zM3.5 .5h1v2h-1z';
const SLEEPY_EYES = 'M1.5 1.5h1v1h-1zM3.5 1.5h1v1h-1z';
const SMILE = 'M.5 3.5h1v1h-1zM4.5 3.5h1v1h-1zM1.5 4.5h3v1h-3z';

type Colours = { fg: string; bg: string; r?: number; className?: string };

export function Mark({ fg, bg, r = 0, className }: Colours) {
  return (
    <svg
      className={className}
      viewBox="0 0 6 6"
      shapeRendering="crispEdges"
      aria-hidden="true">
      <rect width="6" height="6" rx={r} fill={bg} />
      <path d={EYES + SMILE} fill={fg} />
    </svg>
  );
}

/** A contact's identicon, seeded from the name so it never changes. */
export function Ident({
  name,
  fg,
  bg,
}: {
  name: string;
  fg: string;
  bg: string;
}) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  let d = '';
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      if ((hash >> (y * 3 + x)) & 1) {
        d += `M${0.5 + x} ${0.5 + y}h1v1h-1z`;
        if (x < 2) d += `M${4.5 - x} ${0.5 + y}h1v1h-1z`;
      }
    }
  }
  return (
    <svg viewBox="0 0 6 6" shapeRendering="crispEdges" aria-hidden="true">
      <rect width="6" height="6" fill={bg} />
      <path d={d} fill={fg} />
    </svg>
  );
}

export type Mood = 'smile' | 'flat' | 'sleep';
const MOUTH: Record<Mood, [number, number][]> = {
  smile: [
    [0, 3],
    [4, 3],
    [1, 4],
    [2, 4],
    [3, 4],
  ],
  flat: [
    [1, 4],
    [2, 4],
    [3, 4],
  ],
  sleep: [
    [1, 4],
    [2, 4],
    [3, 4],
  ],
};
const MOUTH_CELLS: [number, number][] = MOUTH.smile;

/**
 * Site art only: the logo always smiles, these moods sit around the product.
 * Mouth cells switch one at a time, so a change of mood reads as pixels.
 */
export function Face({
  mood,
  fg,
  bg,
  look = 0,
}: Colours & { mood: Mood; look?: number }) {
  return (
    <svg viewBox="0 0 6 6" shapeRendering="crispEdges" aria-hidden="true">
      <rect width="6" height="6" fill={bg} />
      <path
        d={mood === 'sleep' ? SLEEPY_EYES : EYES}
        fill={fg}
        transform={`translate(${look} 0)`}
      />
      {MOUTH_CELLS.map(([x, y], i) => (
        <rect
          key={`${x}-${y}`}
          x={0.5 + x}
          y={0.5 + y}
          width="1"
          height="1"
          fill={fg}
          style={{
            opacity: MOUTH[mood].some(([mx, my]) => mx === x && my === y)
              ? 1
              : 0,
            transition: `opacity 1ms linear ${i * 70}ms`,
          }}
        />
      ))}
    </svg>
  );
}
