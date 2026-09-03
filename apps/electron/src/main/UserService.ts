import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";
import type { FilesystemService } from "@get-halo/server/filesystem";

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

  constructor(
    private readonly options: {
      appDataDir: string;
      filesystem: FilesystemService;
    },
  ) {}

  async getUser() {
    if (this.user !== undefined) return this.user;

    const path = preferencePath(this.options.appDataDir);
    if (this.options.filesystem.exists(path)) {
      const existing = await readUserPreference(this.options.filesystem, path);
      if (existing instanceof Error) {
        console.warn("Invalid user.json:", existing.message);
      } else {
        this.user = existing;
        return existing;
      }
    }

    const user: User = { id: randomUUID() };
    const written = await writeUserPreference(
      this.options.filesystem,
      this.options.appDataDir,
      user,
    );
    if (written instanceof Error) return written;
    this.user = user;
    return user;
  }
}

function preferencePath(appDataDir: string) {
  return join(appDataDir, preferenceFileName);
}

async function readUserPreference(filesystem: FilesystemService, path: string) {
  const raw = await filesystem.readFile(path, "utf8");
  if (raw instanceof Error) return new UserIoError({ cause: raw });

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

async function writeUserPreference(
  filesystem: FilesystemService,
  appDataDir: string,
  user: User,
) {
  const created = await filesystem.makeDirectory(appDataDir, {
    recursive: true,
    mode: 0o700,
  });
  if (created instanceof Error) return new UserIoError({ cause: created });

  const preference: User = { id: user.id };
  const written = await filesystem.writeFile(
    preferencePath(appDataDir),
    `${JSON.stringify(preference, undefined, 2)}\n`,
    { mode: 0o600 },
  );
  if (written instanceof Error) return new UserIoError({ cause: written });
}
