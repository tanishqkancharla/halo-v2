#!/usr/bin/env -S node --import tsx

import { Cli, z } from "incur";
import { resolveFromInvokeCwd } from "./invokeCwd.js";
import { startServer } from "./serve.js";

Cli.create("tkstack", {
  description: "Serve a spec or code walkthrough as a local page",
  version: "0.1.0",
  args: z.object({
    file: z.string().describe("Path to the markdown file"),
  }),
  options: z.object({
    port: z.coerce.number().optional().describe("Port (default 4177)"),
    root: z.string().optional().describe("Workspace root for file excerpts"),
  }),
  output: z.object({
    url: z.string(),
    file: z.string(),
  }),
  async *run(c) {
    const started = await startServer({
      filePath: resolveFromInvokeCwd(c.args.file),
      workspaceRoot:
        c.options.root === undefined
          ? resolveFromInvokeCwd(".")
          : resolveFromInvokeCwd(c.options.root),
      port: c.options.port === undefined ? 4177 : c.options.port,
    });
    if (started instanceof Error) {
      return c.error({
        code: "TKSTACK",
        message: started.message,
      });
    }
    yield { url: started.url, file: started.filePath };
    await started.closed;
    return { url: started.url, file: started.filePath };
  },
}).serve();
