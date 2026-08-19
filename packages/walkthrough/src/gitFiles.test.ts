import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import * as errore from "errore";
import { readGitFiles } from "./gitFiles.js";

const execFileAsync = promisify(execFile);

describe("readGitFiles", () => {
  test("reports modified and untracked files", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const repo = await mkdtemp(path.join(tmpdir(), "walkthrough-git-"));
    cleanup.defer(() => rm(repo, { recursive: true, force: true }));
    await execFileAsync("git", ["-C", repo, "init"]);
    await execFileAsync("git", [
      "-C",
      repo,
      "config",
      "user.email",
      "dev@example.com",
    ]);
    await execFileAsync("git", ["-C", repo, "config", "user.name", "Dev"]);
    await writeFile(path.join(repo, "kept.ts"), "export const kept = 1\n");
    await execFileAsync("git", ["-C", repo, "add", "kept.ts"]);
    await execFileAsync("git", [
      "-C",
      repo,
      "commit",
      "-m",
      "init",
      "--no-gpg-sign",
    ]);
    await writeFile(path.join(repo, "kept.ts"), "export const kept = 2\n");
    await writeFile(path.join(repo, "new.ts"), "export const next = 1\n");

    const files = await readGitFiles(repo);
    expect(files).toContainEqual({ path: "kept.ts", status: "modified" });
    expect(files).toContainEqual({ path: "new.ts", status: "untracked" });
  });
});
