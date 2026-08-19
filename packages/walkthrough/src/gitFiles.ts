import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { WalkthroughFileError } from "./errors.js";
import type { WalkthroughFile } from "./extractWalkthrough.js";

const execFileAsync = promisify(execFile);

function statusFromGitCode(code: string) {
  if (code === "A" || code === "C") return "added";
  if (code === "D") return "deleted";
  if (code === "M" || code === "T" || code === "U") return "modified";
  if (code === "R") return "renamed";
  if (code === "?") return "untracked";
  return undefined;
}

export async function readGitFiles(workspaceRoot: string, base?: string) {
  const tracked = await gitNameStatus(workspaceRoot, nameStatusArgs(base));
  const untracked = await gitUntracked(workspaceRoot);
  return [...tracked, ...untracked];
}

function nameStatusArgs(base: string | undefined) {
  if (base === undefined) return ["diff", "--name-status", "HEAD"];
  return ["diff", "--name-status", `${base}...HEAD`];
}

async function gitNameStatus(workspaceRoot: string, args: string[]) {
  const result = await git(workspaceRoot, args);
  if (result instanceof Error) return [];
  const files: WalkthroughFile[] = [];
  for (const line of result.split("\n")) {
    if (line.length === 0) continue;
    const code = line[0];
    if (code === undefined) continue;
    const status = statusFromGitCode(code);
    if (status === undefined) continue;
    const columns = line.slice(1).trim().split("\t");
    const path = columns[columns.length - 1];
    if (path === undefined || path.length === 0) continue;
    files.push({ path, status });
  }
  return files;
}

async function gitUntracked(workspaceRoot: string) {
  const result = await git(workspaceRoot, [
    "ls-files",
    "--others",
    "--exclude-standard",
  ]);
  if (result instanceof Error) return [];
  const files: WalkthroughFile[] = [];
  for (const path of result.split("\n")) {
    if (path.length === 0) continue;
    files.push({ path, status: "untracked" });
  }
  return files;
}

async function git(workspaceRoot: string, args: string[]) {
  const result = await execFileAsync("git", ["-C", workspaceRoot, ...args], {
    encoding: "utf8",
  }).catch(
    (cause) =>
      new WalkthroughFileError({
        path: workspaceRoot,
        reason: "git",
        cause,
      }),
  );
  if (result instanceof Error) {
    console.warn(result.message);
    return result;
  }
  return result.stdout.trimEnd();
}
