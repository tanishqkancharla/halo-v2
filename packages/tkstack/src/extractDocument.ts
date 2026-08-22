import { parseFence, type Fence } from "./parseFence.js";

const fencePattern = /^```([^\n]*)\r?\n([\s\S]*?)^```/gm;
const titlePattern = /^#\s+(.+)$/m;

export function extractTitle(source: string) {
  const match = titlePattern.exec(source);
  if (match?.[1] === undefined) return "tkstack";
  return match[1];
}

export function extractFences(source: string) {
  const fences: Fence[] = [];
  for (const match of source.matchAll(fencePattern)) {
    const lang = match[1] ?? "";
    const body = match[2] ?? "";
    fences.push(parseFence(lang.trim(), body));
  }
  return fences;
}
