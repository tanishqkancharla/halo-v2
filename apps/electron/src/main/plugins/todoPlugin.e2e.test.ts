import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const prompt =
  "Build a todo list plugin. I can add items, mark them done, and they survive a reload.";

const providerKeys = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
];

const skipReason = await todoTestSkipReason();

describe.skipIf(skipReason !== undefined)("todo plugin agent", () => {
  test(
    "agent-built todo plugin keeps an item after reload",
    { timeout: 300_000 },
    async () => {
      const workspaceRoot = await readWorkspaceRoot();
      const skill = await readFile(
        fileURLToPath(new URL("./haloPluginSkill.md", import.meta.url)),
        "utf8",
      );
      await writeFile(
        join(
          workspaceRoot,
          ".pi",
          "agent",
          "skills",
          "halo-plugin",
          "SKILL.md",
        ),
        skill.replaceAll(
          "{{HALO_COMPILE_PLUGIN_VIEW}}",
          join(repoRoot, "apps/electron/src/main/plugins/compilePluginView.ts"),
        ),
      );
      await rm(join(workspaceRoot, ".halo", "plugins", "todos"), {
        recursive: true,
        force: true,
      });
      await rm(join(workspaceRoot, ".halo", "plugin-data", "todos"), {
        recursive: true,
        force: true,
      });
      await haloWebExec(`await page.reload()`);

      await haloWebExec(`
        await page.getByRole('button', { name: 'New session' }).click();
        await page.getByLabel('Message').fill(${JSON.stringify(prompt)});
        await page.getByLabel('New session').getByRole('button', { name: 'Send' }).click();
        await page.getByLabel('Thinking').waitFor();
        await page.getByLabel('Thinking').waitFor({ state: 'hidden', timeout: 180_000 });
      `);
      await haloWebExec(`await page.reload()`);
      await haloWebExec(`
        await page.getByTestId('plugin-sidebar-todos').getByRole('link', { name: 'List' }).click();
        await page.getByLabel('New todo').fill('Buy milk');
        await page.getByRole('button', { name: 'Add' }).click();
        await page.getByRole('checkbox', { name: 'Buy milk' }).waitFor();
      `);
      await haloWebExec(`await page.reload()`);
      await haloWebExec(`
        await page.getByTestId('plugin-sidebar-todos').getByRole('link', { name: 'List' }).click();
      `);
      const visible = await haloWebExec(
        `return await page.getByRole('checkbox', { name: 'Buy milk' }).first().isVisible()`,
      );
      expect(visible).toBe(true);
    },
  );
});

async function todoTestSkipReason() {
  if (!hasProviderKey()) return "no provider key";
  if (!existsSync(join(repoRoot, ".halo", "workspace.json"))) {
    return "no workspace preference file";
  }
  const status = await haloWebStatus().catch((error) => ({
    ready: false,
    message: error instanceof Error ? error.message : "halo-web status failed",
  }));
  if (!status.ready) return status.message;
  return undefined;
}

function hasProviderKey() {
  for (const key of providerKeys) {
    const value = process.env[key];
    if (value !== undefined && value.length > 0) return true;
  }
  return false;
}

async function readWorkspaceRoot() {
  const raw = await readFile(join(repoRoot, ".halo", "workspace.json"), "utf8");
  // SAFETY: Halo writes workspace.json as { workspaceRoot: string }.
  const parsed = JSON.parse(raw) as { workspaceRoot: string };
  return parsed.workspaceRoot;
}

async function haloWebStatus() {
  const output = await runHaloWeb(["status"]);
  // SAFETY: incur --json status is { ready, message } or { code, message }.
  const parsed = JSON.parse(output) as {
    ready?: boolean;
    message?: string;
    code?: string;
  };
  if (parsed.ready === true) {
    return {
      ready: true,
      message: parsed.message === undefined ? "ready" : parsed.message,
    };
  }
  return {
    ready: false,
    message:
      parsed.message === undefined ? "halo-web status failed" : parsed.message,
  };
}

async function haloWebExec(source: string) {
  const output = await runHaloWeb(["exec", "--stdin"], source);
  // SAFETY: incur --json exec is { result } or { code, message }.
  const parsed = JSON.parse(output) as {
    result?: unknown;
    code?: string;
    message?: string;
  };
  if (parsed.code !== undefined) {
    throw new Error(
      parsed.message === undefined ? parsed.code : parsed.message,
    );
  }
  return parsed.result;
}

function runHaloWeb(args: string[], stdin?: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("pnpm", ["--silent", "halo-web", "--json", ...args], {
      cwd: repoRoot,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    if (stdin !== undefined) child.stdin.end(stdin);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(
        new Error(
          stderr.length > 0
            ? stderr
            : stdout.length > 0
              ? stdout
              : `halo-web exited ${String(code)}`,
        ),
      );
    });
  });
}
