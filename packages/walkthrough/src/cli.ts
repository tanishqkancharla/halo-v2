#!/usr/bin/env node

import { Cli, z } from "incur";
import { resolveFromInvokeCwd } from "./invokeCwd.js";
import { startWalkthroughServer } from "./serve.js";

Cli.create("walkthrough", {
  description: "Serve a local MDX spec or walkthrough",
  version: "0.1.0",
  args: z.object({
    file: z.string().describe("Path to the spec or walkthrough MDX file"),
  }),
  options: z.object({
    port: z.coerce.number().optional().describe("Port (default 4177)"),
    root: z.string().optional().describe("Workspace root for file excerpts"),
  }),
  output: z.object({
    url: z.string(),
    mdx: z.string(),
  }),
  async *run(c) {
    const started = await startWalkthroughServer({
      mdxPath: resolveFromInvokeCwd(c.args.file),
      workspaceRoot:
        c.options.root === undefined
          ? resolveFromInvokeCwd(".")
          : resolveFromInvokeCwd(c.options.root),
      port: c.options.port === undefined ? 4177 : c.options.port,
    });
    if (started instanceof Error) {
      return c.error({
        code: "WALKTHROUGH",
        message: started.message,
      });
    }
    yield { url: started.url, mdx: started.mdxPath };
    await started.closed;
    return { url: started.url, mdx: started.mdxPath };
  },
}).serve();
