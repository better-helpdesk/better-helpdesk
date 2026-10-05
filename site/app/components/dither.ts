const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export const reduced = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Covers the frame with 8px cells in Bayer order, or clears it. Timed steps
 * rather than requestAnimationFrame: a background tab must still finish.
 */
export function dither(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  cover: boolean,
  ms: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve();
  const w = Math.ceil(host.clientWidth / 8);
  const h = Math.ceil(host.clientHeight / 8);
  canvas.width = w;
  canvas.height = h;
  ctx.fillStyle = getComputedStyle(host).backgroundColor;
  if (reduced()) {
    ctx.clearRect(0, 0, w, h);
    return Promise.resolve();
  }
  return new Promise<void>(resolve => {
    let level = 0;
    const step = () => {
      level += 2;
      ctx.clearRect(0, 0, w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const b = BAYER[(x % 4) + 4 * (y % 4)] ?? 0;
          if (cover ? b < level : b >= level) ctx.fillRect(x, y, 1, 1);
        }
      }
      if (level < 16) setTimeout(step, ms / 8);
      else resolve();
    };
    step();
  });
}
