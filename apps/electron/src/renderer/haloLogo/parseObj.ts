import * as errore from "errore";

class ObjParseError extends errore.createTaggedError({
  name: "ObjParseError",
  message: "OBJ parse failed: $detail",
}) {}

export function parseObj(source: string) {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const lines = source.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    if (line.startsWith("#")) continue;

    const parts = line.split(/\s+/u);
    const kind = parts[0];
    if (kind === "v") {
      const parsed = parseVec3(parts, "position");
      if (parsed instanceof Error) return parsed;
      positions.push(parsed[0], parsed[1], parsed[2]);
      continue;
    }
    if (kind === "vn") {
      const parsed = parseVec3(parts, "normal");
      if (parsed instanceof Error) return parsed;
      normals.push(parsed[0], parsed[1], parsed[2]);
      continue;
    }
    if (kind !== "f") continue;

    const face = parseFace(parts, positions.length / 3, normals.length / 3);
    if (face instanceof Error) return face;
    indices.push(...face);
  }

  if (positions.length === 0) {
    return new ObjParseError({ detail: "no positions" });
  }
  if (positions.length !== normals.length) {
    return new ObjParseError({
      detail: `position/normal count mismatch (${positions.length / 3} vs ${normals.length / 3})`,
    });
  }
  if (indices.length === 0) {
    return new ObjParseError({ detail: "no faces" });
  }

  const vertexCount = positions.length / 3;
  const vertices = new Float32Array(vertexCount * 6);
  for (let i = 0; i < vertexCount; i += 1) {
    const src = i * 3;
    const dst = i * 6;
    vertices[dst] = positions[src];
    vertices[dst + 1] = positions[src + 1];
    vertices[dst + 2] = positions[src + 2];
    vertices[dst + 3] = normals[src];
    vertices[dst + 4] = normals[src + 1];
    vertices[dst + 5] = normals[src + 2];
  }

  return { vertices, indices: new Uint32Array(indices) };
}

function parseVec3(parts: string[], label: string) {
  const x = Number(parts[1]);
  const y = Number(parts[2]);
  const z = Number(parts[3]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return new ObjParseError({ detail: `bad ${label} line` });
  }
  return [x, y, z] as const;
}

function parseFace(
  parts: string[],
  positionCount: number,
  normalCount: number,
) {
  if (parts.length !== 4) {
    return new ObjParseError({
      detail: `expected triangle faces, got ${parts.length - 1} corners`,
    });
  }
  const corners = [parts[1], parts[2], parts[3]];
  const indices: number[] = [];
  for (const corner of corners) {
    if (corner === undefined) {
      return new ObjParseError({ detail: "missing face corner" });
    }
    const index = parseCorner(corner, positionCount, normalCount);
    if (index instanceof Error) return index;
    indices.push(index);
  }
  return indices;
}

function parseCorner(
  token: string,
  positionCount: number,
  normalCount: number,
) {
  const pieces = token.split("//");
  if (pieces.length !== 2) {
    return new ObjParseError({ detail: `expected v//vn corner, got ${token}` });
  }
  const positionIndex = Number(pieces[0]);
  const normalIndex = Number(pieces[1]);
  if (
    !Number.isInteger(positionIndex) ||
    !Number.isInteger(normalIndex) ||
    positionIndex !== normalIndex
  ) {
    return new ObjParseError({ detail: `unsupported corner ${token}` });
  }
  const index = positionIndex - 1;
  if (index < 0 || index >= positionCount || index >= normalCount) {
    return new ObjParseError({ detail: `corner index out of range ${token}` });
  }
  return index;
}
