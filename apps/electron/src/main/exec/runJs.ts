import type { AgentTools } from "./agentTools.js";

// Wraps user JS to always return a serialized string. The user's return value
// is captured via an inner async IIFE so `return x` in user code works as expected.
function wrapJs(js: string): string {
  return [
    "const __result = await (async () => { " + js + " })();",
    "if (__result === undefined) return undefined;",
    "if (__result instanceof Error) return __result.message;",
    "return JSON.stringify(__result, undefined, 2) ?? String(__result);",
  ].join("\n");
}

type AsyncFunctionConstructor = new (
  ...args: string[]
) => (
  tools: AgentTools,
  console: { log: (...args: unknown[]) => void },
) => Promise<string | undefined>;

// SAFETY: Object.getPrototypeOf(async () => {}).constructor is AsyncFunction in every V8/Node environment.
const AsyncFunction = Object.getPrototypeOf(async () => {})
  .constructor as AsyncFunctionConstructor;

type RunJsResult = { value: string | undefined; logs: string[] };

export async function runJs(
  js: string,
  tools: AgentTools,
): Promise<RunJsResult> {
  const logs: string[] = [];
  const fn = new AsyncFunction("tools", "console", wrapJs(js));
  const value = await fn(tools, {
    log: (...args) => {
      logs.push(args.map(String).join(" "));
    },
  });
  return { value, logs };
}
