import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import * as errore from "errore";

export class McpHttpError extends errore.createTaggedError({
  name: "McpHttpError",
  message: "MCP request failed",
}) {}

const parallelSearchMcpUrl = "https://search.parallel.ai/mcp";

export class McpHttpClient {
  private readonly client = new Client({ name: "halo", version: "1" });
  private connectPromise: Promise<void | McpHttpError> | null = null;

  async callTool(args: {
    name: string;
    arguments: Record<string, unknown>;
    signal?: AbortSignal;
  }) {
    const connected = await this.ensureConnected();
    if (connected instanceof Error) return connected;

    const result = await this.client
      .callTool({ name: args.name, arguments: args.arguments }, undefined, {
        signal: args.signal,
      })
      .catch((e) => new McpHttpError({ cause: e }));
    if (result instanceof Error) return result;
    return toolResultText(result);
  }

  private ensureConnected() {
    if (this.connectPromise === null) {
      this.connectPromise = this.connect().then((result) => {
        if (McpHttpError.is(result)) {
          this.connectPromise = null;
          return result;
        }
      });
    }
    return this.connectPromise;
  }

  private async connect() {
    const connected = await this.client
      .connect(new StreamableHTTPClientTransport(new URL(parallelSearchMcpUrl)))
      .catch((e) => new McpHttpError({ cause: e }));
    if (connected instanceof Error) return connected;
  }
}

function toolResultText(result: unknown) {
  if (typeof result !== "object" || result === null) return "";
  if (!("content" in result) || !Array.isArray(result.content)) return "";
  return result.content
    .flatMap((part) => {
      if (typeof part !== "object" || part === null) return [];
      if (!("type" in part) || part.type !== "text") return [];
      if (!("text" in part) || typeof part.text !== "string") return [];
      return [part.text];
    })
    .join("");
}
