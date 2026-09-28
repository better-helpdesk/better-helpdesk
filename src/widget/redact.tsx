import { useEffect, useRef, useState } from 'react';

import type { Translate } from '../ui/i18n';

type Rect = { x: number; y: number; w: number; h: number };

/** Captures one frame of a tab the user picks. The browser asks for consent. */
export async function captureScreen(): Promise<HTMLCanvasElement> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
    preferCurrentTab: true,
  } as DisplayMediaStreamOptions);
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise(resolve => requestAnimationFrame(resolve));
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    return canvas;
  } finally {
    for (const track of stream.getTracks()) track.stop();
  }
}

export function Redactor({
  source,
  t,
  onDone,
  onCancel,
}: {
  source: HTMLCanvasElement;
  t: Translate;
  onDone: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [rects, setRects] = useState<Rect[]>([]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<Rect | null>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    el.width = source.width;
    el.height = source.height;
    ctx.drawImage(source, 0, 0);
    ctx.fillStyle = '#000';
    for (const r of preview ? [...rects, preview] : rects) {
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
  }, [source, rects, preview]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const el = event.currentTarget;
    const box = el.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * el.width,
      y: ((event.clientY - box.top) / box.height) * el.height,
    };
  };

  const rectFrom = (
    a: { x: number; y: number },
    b: { x: number; y: number }
  ) => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  });

  return (
    <div
      className="redact"
      role="dialog"
      aria-modal="true"
      aria-label={t('redact.title')}
      onKeyDown={e => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        onCancel();
      }}>
      <div className="redact-inner">
        <strong>{t('redact.title')}</strong>
        <span className="muted">{t('redact.hint')}</span>
        <canvas
          ref={canvas}
          onPointerDown={e => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = point(e);
          }}
          onPointerMove={e => {
            if (drag.current) setPreview(rectFrom(drag.current, point(e)));
          }}
          onPointerUp={e => {
            if (drag.current) {
              const r = rectFrom(drag.current, point(e));
              if (r.w > 3 && r.h > 3) setRects(list => [...list, r]);
            }
            drag.current = null;
            setPreview(null);
          }}
        />
        <div className="row">
          <button
            type="button"
            className="secondary"
            disabled={rects.length === 0}
            onClick={() => setRects(list => list.slice(0, -1))}>
            {t('redact.undo')}
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            {t('redact.cancel')}
          </button>
          <button
            type="button"
            className="primary"
            onClick={() =>
              canvas.current?.toBlob(blob => blob && onDone(blob), 'image/png')
            }>
            {t('redact.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
