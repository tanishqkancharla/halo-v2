#!/usr/bin/env -S node --import tsx

import path from "node:path";
import { Cli, z } from "incur";
import { startServer } from "./serve.js";

function invokeWorkingDirectory() {
  if (process.env.INIT_CWD === undefined) return process.cwd();
  return process.env.INIT_CWD;
}

const cli = Cli.create("flowstack", {
  description: "Serve the Halo event flow call stack viewer as a local page",
  version: "0.1.0",
  options: z.object({
    port: z.coerce.number().optional().describe("Port (default 4188)"),
    host: z
      .string()
      .optional()
      .describe("Listen host (default 127.0.0.1; use 0.0.0.0 to expose)"),
    root: z.string().optional().describe("Repository root for source excerpts"),
  }),
  output: z.object({
    url: z.string(),
  }),
  async *run(c) {
    const started = await startServer({
      workspaceRoot:
        c.options.root === undefined
          ? invokeWorkingDirectory()
          : path.resolve(invokeWorkingDirectory(), c.options.root),
      port: c.options.port === undefined ? 4188 : c.options.port,
      host: c.options.host === undefined ? "127.0.0.1" : c.options.host,
    });
    if (started instanceof Error) {
      return c.error({ code: "FLOWSTACK", message: started.message });
    }
    yield { url: started.url };
    await started.closed;
    return { url: started.url };
  },
});

await cli.serve();
