import { parseFence, type Fence } from "./parseFence.js";

export type WalkthroughFile = {
  path: string;
  status:
    | "added"
    | "deleted"
    | "ignored"
    | "modified"
    | "renamed"
    | "untracked";
};

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

export function filesFromFences(fences: readonly Fence[]) {
  const files: WalkthroughFile[] = [];
  const seen = new Set<string>();
  for (const fence of fences) {
    if (fence.kind === "tree") {
      for (const path of fence.paths) {
        addFile(files, seen, path, "modified");
      }
      continue;
    }
    if (fence.kind === "file") {
      addFile(files, seen, fence.path, "modified");
      continue;
    }
    if (fence.kind === "diff" && fence.path !== undefined) {
      addFile(files, seen, fence.path, "modified");
    }
  }
  return files;
}

export function mergeWalkthroughFiles(
  gitFiles: readonly WalkthroughFile[],
  fenceFiles: readonly WalkthroughFile[],
) {
  const files: WalkthroughFile[] = [];
  const seen = new Set<string>();
  for (const file of gitFiles) addFile(files, seen, file.path, file.status);
  for (const file of fenceFiles) addFile(files, seen, file.path, file.status);
  return files;
}

function addFile(
  files: WalkthroughFile[],
  seen: Set<string>,
  path: string,
  status: WalkthroughFile["status"],
) {
  if (seen.has(path)) return;
  seen.add(path);
  files.push({ path, status });
}
