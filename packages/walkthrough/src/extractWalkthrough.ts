import { parseFence, type Fence } from "./parseFence.js";

const fencePattern = /^```([^\n]*)\r?\n([\s\S]*?)^```/gm;
const titlePattern = /^#\s+(.+)$/m;

export function extractTitle(mdx: string) {
  const match = titlePattern.exec(mdx);
  if (match?.[1] === undefined) return "Walkthrough";
  return match[1];
}

export function extractFences(mdx: string) {
  const fences: Fence[] = [];
  for (const match of mdx.matchAll(fencePattern)) {
    const lang = match[1] ?? "";
    const body = match[2] ?? "";
    fences.push(parseFence(lang.trim(), body));
  }
  return fences;
}
