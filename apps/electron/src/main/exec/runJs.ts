import type { AgentTools } from "./agentTools.js";

type AsyncFunctionConstructor = new (
  ...args: string[]
) => (
  tools: AgentTools,
  console: { log: (...args: unknown[]) => void },
) => Promise<unknown>;

const AsyncFunction = Object.getPrototypeOf(async () => {})
  .constructor as AsyncFunctionConstructor;

export async function runJs(js: string, tools: AgentTools) {
  const logs: string[] = [];
  const fn = new AsyncFunction("tools", "console", js);
  const value = await fn(tools, {
    log: (...args) => {
      logs.push(args.map(String).join(" "));
    },
  });
  return { value, logs };
}
