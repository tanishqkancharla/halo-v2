import { expect } from "@playwright/test";
import { exec as execCallback } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";
import { e2eTest } from "./e2eTest.js";

const execAsync = promisify(execCallback);

e2eTest(
  "does not expose the RPC connection on any process command line",
  async ({ renderer }) => {
    await renderer.page.getByRole("main").waitFor();
    const commandLines = await allProcessCommandLines();
    const leaked = commandLines.filter(
      (line) =>
        line.includes("--halo-rpc-token=") ||
        line.includes("--halo-rpc-origin="),
    );
    expect(leaked, "RPC connection leaked onto a process command line").toEqual(
      [],
    );
  },
);

async function allProcessCommandLines(): Promise<string[]> {
  if (process.platform === "linux") {
    return linuxProcessCommandLines();
  }
  if (process.platform === "win32") {
    const { stdout } = await execAsync(
      'powershell -NoProfile -Command "Get-CimInstance -ClassName Win32_Process | ForEach-Object { $_.CommandLine }"',
      { maxBuffer: 64 * 1024 * 1024 },
    );
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
  const { stdout } = await execAsync("ps -ax -o args=", {
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function linuxProcessCommandLines(): string[] {
  const lines: string[] = [];
  for (const entry of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const buffer = fs.readFileSync(`/proc/${entry}/cmdline`);
      if (buffer.length === 0) continue;
      const commandLine = buffer
        .toString("utf8")
        .split("\0")
        .filter((arg) => arg.length > 0)
        .join(" ");
      if (commandLine.length > 0) lines.push(commandLine);
    } catch {
      // The process exited while we were reading, or its /proc entry is
      // unreadable; either way it cannot be the Halo renderer we launched.
    }
  }
  return lines;
}
