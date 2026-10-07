import { ImageResponse } from 'next/og';

/** The face of app/icon.svg, drawn as a PNG for places that take no SVG. */
export function iconImage(size: number) {
  const svg = encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6 6" shape-rendering="crispEdges"><rect width="6" height="6" fill="#000"/><path fill="#fff" d="M1.5 .5h1v2h-1zM3.5 .5h1v2h-1zM.5 3.5h1v1h-1zM4.5 3.5h1v1h-1zM1.5 4.5h3v1h-3z"/></svg>'
  );
  return new ImageResponse(
    // biome-ignore lint/performance/noImgElement: next/og renders plain img only
    <img alt="" src={`data:image/svg+xml,${svg}`} width={size} height={size} />,
    { width: size, height: size }
  );
}
