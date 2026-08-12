import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { UserService } from "./UserService.js";

async function testDirectory(name: string) {
  return mkdtemp(join(tmpdir(), `halo-${name}-`));
}

describe("UserService", () => {
  test("creates a user id and reuses it from app data", async () => {
    const appDataDir = await testDirectory("user");
    const first = await new UserService(appDataDir).getUser();
    expect(first).not.toBeInstanceOf(Error);
    if (first instanceof Error) return;

    const second = await new UserService(appDataDir).getUser();
    expect(second).toEqual(first);
  });
});
