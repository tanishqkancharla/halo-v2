import { describe, expect, test } from "vitest";
import { cornerPixelation, rotationX } from "./pixelation.ts";

describe("cornerPixelation", () => {
  test("is off when looking through the hole", () => {
    expect(cornerPixelation(0)).toBe(0);
    expect(cornerPixelation(Math.PI)).toBe(0);
  });

  test("is full when the torus is edge-on", () => {
    expect(cornerPixelation(Math.PI / 2)).toBe(1);
    expect(cornerPixelation((3 * Math.PI) / 2)).toBe(1);
  });

  test("stays off until the turn reaches the corner", () => {
    expect(cornerPixelation(Math.asin(0.4))).toBe(0);
    expect(cornerPixelation(Math.asin(0.8))).toBeGreaterThan(0);
    expect(cornerPixelation(Math.asin(0.8))).toBeLessThan(1);
  });
});

describe("rotationX", () => {
  test("writes a column-major X rotation", () => {
    const matrix = rotationX(Math.PI / 2);
    expect(matrix[0]).toBe(1);
    expect(matrix[5]).toBeCloseTo(0);
    expect(matrix[6]).toBeCloseTo(1);
    expect(matrix[9]).toBeCloseTo(-1);
    expect(matrix[10]).toBeCloseTo(0);
  });
});
