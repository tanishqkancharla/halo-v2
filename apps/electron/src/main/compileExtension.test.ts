import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { calendarExtensionSource } from "./bundledExtensions.ts";
import {
  compileExtensionDirectory,
  ExtensionCompileError,
  ExtensionEntryMissingError,
  findExtensionEntry,
} from "./compileExtension.ts";

async function testDirectory(name: string) {
  return mkdtemp(join(tmpdir(), `halo-${name}-`));
}

describe("compileExtensionDirectory", () => {
  test("compiles TSX that imports maui and react", async () => {
    const directory = join(await testDirectory("compile-ok"), "calendar");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "index.tsx"), calendarExtensionSource);

    const compiled = await compileExtensionDirectory({
      id: "calendar",
      directory,
    });
    expect(compiled).not.toBeInstanceOf(Error);
    if (compiled instanceof Error) return;
    expect(compiled.id).toBe("calendar");
    expect(compiled.source.includes("sidebarEntries")).toBe(true);
    expect(compiled.source.includes("Calendar")).toBe(true);
    expect(compiled.source.includes('require("maui")')).toBe(true);
    expect(compiled.source.includes('require("react")')).toBe(true);
  });

  test("returns ExtensionCompileError for invalid syntax", async () => {
    const directory = join(await testDirectory("compile-bad"), "broken");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "index.tsx"), "export default {");

    const compiled = await compileExtensionDirectory({
      id: "broken",
      directory,
    });
    expect(compiled).toBeInstanceOf(ExtensionCompileError);
  });

  test("returns ExtensionEntryMissingError when index is absent", async () => {
    const directory = join(await testDirectory("compile-missing"), "empty");
    await mkdir(directory, { recursive: true });

    const compiled = await compileExtensionDirectory({
      id: "empty",
      directory,
    });
    expect(compiled).toBeInstanceOf(ExtensionEntryMissingError);
    expect(findExtensionEntry(directory)).toBeUndefined();
  });
});
