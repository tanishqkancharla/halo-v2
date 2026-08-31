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
