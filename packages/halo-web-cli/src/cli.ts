#!/usr/bin/env node

import { Cli, z } from "incur";
import { execute, getStatus, snapshot } from "./browser-tools.js";

const readPageSource = "return await page.locator('body').innerText()";
const readPageCommand = `exec '${readPageSource}'`;

async function readStdin(): Promise<string> {
  process.stdin.setEncoding("utf8");
  let source = "";
  // SAFETY: setEncoding("utf8") makes stdin yield strings.
  for await (const chunk of process.stdin as AsyncIterable<string>) {
    source += chunk;
  }
  return source;
}

Cli.create("halo-web", {
  description: "Control the webview in a running Halo debug app",
  version: "0.1.0",
})
  .command("status", {
    description: "Check whether Halo's debug browser is ready",
    output: z.object({
      ready: z.boolean(),
      message: z.string(),
    }),
    async run(c) {
      const status = await getStatus();
      if (status instanceof Error) {
        return c.error({
          code: "BROWSER_TOOLS",
          message: status.message,
        });
      }
      return c.ok(status, {
        cta: {
          commands: [
            {
              command: readPageCommand,
              description: "Read the current page",
            },
          ],
        },
      });
    },
  })
  .command("snapshot", {
    description: "Read Halo's accessibility tree",
    options: z.object({
      screenshot: z.boolean().optional().describe("Include a PNG screenshot"),
    }),
    output: z.object({
      screenshot: z
        .object({ base64: z.string(), mimeType: z.literal("image/png") })
        .optional(),
      tree: z.string(),
    }),
    async run(c) {
      const includeScreenshot = c.options.screenshot === true;
      const result = await snapshot(includeScreenshot);
      if (result instanceof Error) {
        return c.error({
          code: "BROWSER_TOOLS",
          message: result.message,
        });
      }
      return c.ok(result);
    },
  })
  .command("exec", {
    description: "Run Browser Tools code against Halo",
    args: z.object({
      source: z
        .string()
        .optional()
        .describe("Async function body with page in scope"),
    }),
    options: z.object({
      stdin: z.boolean().optional().describe("Read the script from stdin"),
    }),
    output: z.object({
      result: z.unknown(),
      snapshotDiff: z.string(),
      stderr: z.string(),
      stdout: z.string(),
    }),
    async run(c) {
      let source: string;
      if (c.options.stdin) {
        if (c.args.source !== undefined) {
          return c.error({
            code: "INVALID_INPUT",
            message: "Pass a script argument or --stdin, not both.",
          });
        }
        source = await readStdin();
      } else {
        if (c.args.source === undefined) {
          return c.error({
            code: "INVALID_INPUT",
            message: "Pass a script argument or use --stdin.",
          });
        }
        source = c.args.source;
      }

      if (source.trim().length === 0) {
        return c.error({
          code: "INVALID_INPUT",
          message: "The script cannot be empty.",
        });
      }

      const result = await execute(source);
      if (result instanceof Error) {
        return c.error({
          code: "BROWSER_TOOLS",
          message: result.message,
        });
      }
      return c.ok(
        {
          ...result,
          // incur JSON output drops undefined; null keeps an explicit empty result.
          // oxlint-disable-next-line unicorn/no-null
          result: result.result === undefined ? null : result.result,
        },
        {
          cta: {
            commands: [
              {
                command: readPageCommand,
                description: "Inspect the page after this action",
              },
              { command: "status", description: "Check the connection" },
            ],
          },
        },
      );
    },
  })
  .serve();
