const PIXELATION_START = 0.55;
const PIXELATION_END = 0.98;

/** Column-major rotation around X, the torus side axis (hole is Z). */
export function rotationX(angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return new Float32Array([
    1,
    0,
    0,
    0,
    0,
    cos,
    sin,
    0,
    0,
    -sin,
    cos,
    0,
    0,
    0,
    0,
    1,
  ]);
}

/** 0 face-on, 1 edge-on — the shader ramps as the torus turns the corner. */
export function cornerPixelation(angle: number) {
  const edge = Math.abs(Math.sin(angle));
  const t = (edge - PIXELATION_START) / (PIXELATION_END - PIXELATION_START);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}
