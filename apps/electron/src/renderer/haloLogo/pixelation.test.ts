import { describe, expect, test } from "vitest";
import { rotationX } from "./pixelation.ts";

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
