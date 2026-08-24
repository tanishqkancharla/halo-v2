import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";

type User = {
  id: string;
};

export class UserIoError extends errore.createTaggedError({
  name: "UserIoError",
  message: "User I/O failed",
}) {}

const preferenceFileName = "user.json";

const userPreferenceSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
});

export class UserService {
  private user: User | undefined;

  constructor(private readonly appDataDir: string) {}

  async getUser() {
    if (this.user !== undefined) return this.user;

    const path = preferencePath(this.appDataDir);
    if (existsSync(path)) {
      const existing = await readUserPreference(path);
      if (existing instanceof Error) {
        console.warn("Invalid user.json:", existing.message);
      } else {
        this.user = existing;
        return existing;
      }
    }

    const user: User = { id: randomUUID() };
    const written = await writeUserPreference(this.appDataDir, user);
    if (written instanceof Error) return written;
    this.user = user;
    return user;
  }
}

function preferencePath(appDataDir: string) {
  return join(appDataDir, preferenceFileName);
}

async function readUserPreference(path: string) {
  const raw = await readFile(path, "utf8").catch(
    (e) => new UserIoError({ cause: e }),
  );
  if (raw instanceof Error) return raw;

  const parsed = errore.try({
    try: () => {
      // SAFETY: JSON.parse is untyped; userPreferenceSchema is the file contract.
      return JSON.parse(raw) as unknown;
    },
    catch: (e) => new UserIoError({ cause: e }),
  });
  if (parsed instanceof Error) return parsed;
  if (!Value.Check(userPreferenceSchema, parsed)) return new UserIoError();
  return { id: parsed.id };
}

async function writeUserPreference(appDataDir: string, user: User) {
  const created = await mkdir(appDataDir, {
    recursive: true,
    mode: 0o700,
  }).catch((e) => new UserIoError({ cause: e }));
  if (created instanceof Error) return created;

  const preference: User = { id: user.id };
  const written = await writeFile(
    preferencePath(appDataDir),
    `${JSON.stringify(preference, undefined, 2)}\n`,
    { mode: 0o600 },
  ).catch((e) => new UserIoError({ cause: e }));
  if (written instanceof Error) return written;
}
