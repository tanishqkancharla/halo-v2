import { describe, expect, test } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { parseObj } from "./parseObj.ts";

const triangleObj = `# test
v 0 0 0
vn 0 0 1
v 1 0 0
vn 0 0 1
v 0 1 0
vn 0 0 1
f 1//1 2//2 3//3
`;

describe("parseObj", () => {
  test("builds interleaved vertices and triangle indices", () => {
    const mesh = parseObj(triangleObj);
    if (mesh instanceof Error) throw mesh;

    expect(Array.from(mesh.vertices)).toEqual([
      0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1,
    ]);
    expect(Array.from(mesh.indices)).toEqual([0, 1, 2]);
  });

  test("rejects a face that is not a triangle", () => {
    const mesh = parseObj(`${triangleObj}f 1//1 2//2 3//3 1//1\n`);
    expect(mesh).toBeInstanceOf(Error);
  });

  test("parses the halo donut asset", () => {
    const source = fs.readFileSync(
      fileURLToPath(new URL("../assets/halo-donut-3d.obj", import.meta.url)),
      "utf8",
    );
    const mesh = parseObj(source);
    if (mesh instanceof Error) throw mesh;
    expect(mesh.vertices.length % 6).toBe(0);
    expect(mesh.indices.length % 3).toBe(0);
    expect(mesh.indices.length).toBeGreaterThan(1000);
  });
});
