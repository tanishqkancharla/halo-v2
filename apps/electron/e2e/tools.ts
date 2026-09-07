import { createORPCClient } from "@orpc/client";
import type { HaloClient } from "@get-halo/shared/contract";
import type { readFile, writeFile } from "@get-halo/server/filesystem";

type HarnessTools = {
  files: {
    read(
      input: Parameters<typeof readFile>[0]["input"],
    ): Promise<Exclude<Awaited<ReturnType<typeof readFile>>, Error>>;
    write(
      input: Parameters<typeof writeFile>[0]["input"],
    ): Promise<Exclude<Awaited<ReturnType<typeof writeFile>>, Error>>;
  };
};

export function createHarnessTools(client: HaloClient): HarnessTools {
  return createORPCClient<HarnessTools>({
    call(path, input, options) {
      return client.testHarness.invokeTool(
        { path: path.join("."), input },
        { signal: options.signal },
      );
    },
  });
}
