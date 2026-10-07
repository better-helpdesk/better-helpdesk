const SVG = 'http://www.w3.org/2000/svg';
// Concentric cracks join neighbouring rays at these distances from the press.
const RINGS = [48, 144, 320] as const;
// A crack's band, by the distance of its start: the bands appear 60ms apart.
const BANDS = [96, 240, 480];
const ALPHA = [0.6, 0.36, 0.2, 0.1];

type Pt = { x: number; y: number; r: number };

const snap = (v: number) => Math.round(v / 8) * 8;

function add(
  parent: Element,
  tag: string,
  attrs: Record<string, string | number> = {}
) {
  const el = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs))
    el.setAttribute(key, String(value));
  parent.append(el);
  return el;
}

/** Cracks the page's ground behind its content from (x, y), then clears itself. */
export function shatter(x: number, y: number) {
  const w = innerWidth;
  const h = innerHeight;
  const reach = Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
  const count = w < 560 ? 8 : 11;
  const rays: Pt[][] = [];
  for (let i = 0; i < count; i++) {
    const a = ((i + Math.random() * 0.6 - 0.3) / count) * 2 * Math.PI;
    const ray: Pt[] = [{ x, y, r: 0 }];
    for (let r = 0; r < reach; ) {
      r += 24 + Math.random() * 48;
      // Glass cracks run straight: each vertex strays from the ray, never drifts.
      const bend = a + (Math.random() - 0.5) * 0.12;
      ray.push({
        x: snap(x + Math.cos(bend) * r),
        y: snap(y + Math.sin(bend) * r),
        r,
      });
    }
    rays.push(ray);
  }
  const near = (ray: Pt[], r: number) =>
    ray.reduce((best, p) =>
      Math.abs(p.r - r) < Math.abs(best.r - r) ? p : best
    );
  const paths = ['', '', '', ''];
  const crack = (a: Pt, b: Pt) => {
    paths[BANDS.filter(d => a.r >= d).length] += `M${a.x} ${a.y}L${b.x} ${b.y}`;
  };
  for (const ray of rays) {
    let prev: Pt | null = null;
    for (const p of ray) {
      if (prev) crack(prev, p);
      prev = p;
    }
  }

  const shards: { points: string; dx: number; dy: number }[] = [];
  rays.forEach((ray, i) => {
    const next = rays[(i + 1) % count] ?? ray;
    const made = RINGS.map(r => {
      if (Math.random() < 0.3) return false;
      crack(near(ray, r), near(next, r));
      return true;
    });
    if (!made[0] || !made[1]) return;
    const corners = [
      near(ray, RINGS[0]),
      near(ray, RINGS[1]),
      near(next, RINGS[1]),
      near(next, RINGS[0]),
    ];
    const mx = corners.reduce((s, p) => s + p.x, 0) / 4 - x;
    const my = corners.reduce((s, p) => s + p.y, 0) / 4 - y;
    const len = Math.hypot(mx, my) || 1;
    shards.push({
      points: corners.map(p => `${p.x},${p.y}`).join(' '),
      dx: Math.round((mx / len) * 2),
      dy: Math.round((my / len) * 2),
    });
  });

  const svg = add(document.body, 'svg', {
    class: 'glass',
    'aria-hidden': 'true',
    width: w,
    height: h,
  });
  const body = document.body.getBoundingClientRect();
  const dots = add(add(svg, 'defs'), 'pattern', {
    id: 'glass-dots',
    width: 16,
    height: 16,
    patternUnits: 'userSpaceOnUse',
    // The ground's own dot grid (site.css body), moved 2px: the glass bends it.
    x: (((body.left % 16) + 16) % 16) + 2,
    y: (((body.top % 16) + 16) % 16) + 2,
  });
  add(dots, 'circle', { cx: 8, cy: 8, r: 1.15 });
  const group = add(svg, 'g', { class: 'glass-shards' });
  for (const shard of shards)
    add(group, 'polygon', {
      points: shard.points,
      style: `--dx:${shard.dx}px;--dy:${shard.dy}px`,
    });
  paths.forEach((d, i) => {
    const ring = add(svg, 'g', {
      class: 'glass-ring',
      style: `--i:${i};--o:${ALPHA[i]}`,
      'stroke-width': i ? 1 : 1.5,
    });
    add(ring, 'path', { d });
  });

  let done = false;
  const clear = () => {
    if (done) return;
    done = true;
    removeEventListener('scroll', scrolled);
    removeEventListener('resize', clear);
    svg.classList.add('clear');
    // A timer, not animationend: reduced-motion CSS and hidden tabs never fire it.
    setTimeout(() => svg.remove(), 360);
  };
  const top = scrollY;
  // Momentum and smooth scrolling still move the page a little after a press.
  const scrolled = () => {
    if (Math.abs(scrollY - top) > 48) clear();
  };
  setTimeout(clear, 1600);
  addEventListener('scroll', scrolled, { passive: true });
  addEventListener('resize', clear);
}
