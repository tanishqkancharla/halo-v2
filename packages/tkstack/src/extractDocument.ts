import { parseFence, type Fence } from "./parseFence.js";
import {
  parseViewerDocument,
  type ViewerElement,
  type ViewerNode,
} from "./parseViewer.js";

const fencePattern = /^```([^\n]*)\r?\n([\s\S]*?)^```/gm;

export function extractTitle(source: string) {
  const doc = parseViewerDocument(source);
  if (doc instanceof Error) return "tkstack";
  const h1 = doc.nodes.find(
    (node): node is ViewerElement =>
      node.type === "element" && node.tag === "h1",
  );
  if (h1 === undefined) return "tkstack";
  return viewerText(h1.children);
}

function viewerText(nodes: ViewerNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return node.value;
      if (node.type === "element") return viewerText(node.children);
      return "";
    })
    .join("");
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
