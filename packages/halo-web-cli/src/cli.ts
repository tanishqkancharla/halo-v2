#!/usr/bin/env node

import { Cli, z } from "incur";
import { execute, getStatus } from "./webdriver.js";

const readPageSource = 'return await browser.$("body").getText()';
const readPageCommand = `exec '${readPageSource}'`;

async function readStdin(): Promise<string> {
  process.stdin.setEncoding("utf8");
  let source = "";
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
    description: "Check whether Halo's debug WebDriver is ready",
    output: z.object({
      ready: z.boolean(),
      message: z.string(),
    }),
    async run(c) {
      const status = await getStatus();
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
  .command("exec", {
    description: "Run an async WebdriverIO script against Halo",
    args: z.object({
      source: z
        .string()
        .optional()
        .describe("Async function body with browser in scope"),
    }),
    options: z.object({
      stdin: z.boolean().optional().describe("Read the script from stdin"),
    }),
    output: z.object({ result: z.unknown() }),
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
      return c.ok(
        { result: result === undefined ? null : result },
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
