import * as errore from "errore";

export class McpHttpError extends errore.createTaggedError({
  name: "McpHttpError",
  message: "MCP request failed: $reason",
}) {}

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: number;
  method: string;
  params?: unknown;
};

type JsonRpcError = {
  code: number;
  message: string;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: JsonRpcError;
};

type McpTextContent = {
  type: "text";
  text: string;
};

type CallToolResult = {
  content?: unknown;
  isError?: boolean;
};

const protocolVersion = "2025-06-18";

export class McpHttpClient {
  private mcpSessionId: string | null = null;
  private nextId = 1;
  private connectPromise: Promise<void | McpHttpError> | null = null;

  constructor(
    private readonly options: {
      url: string;
      authorization?: string;
    },
  ) {}

  async callTool(args: {
    name: string;
    arguments: Record<string, unknown>;
    signal?: AbortSignal;
  }) {
    const connected = await this.ensureConnected(args.signal);
    if (connected instanceof Error) return connected;

    const result = await this.request(
      "tools/call",
      {
        name: args.name,
        arguments: args.arguments,
      },
      args.signal,
    );
    if (result instanceof Error) return result;

    return toolResultText(result);
  }

  private ensureConnected(signal?: AbortSignal) {
    if (this.mcpSessionId !== null) return Promise.resolve();
    if (this.connectPromise === null) {
      this.connectPromise = this.connect(signal).then((result) => {
        if (McpHttpError.is(result)) {
          this.connectPromise = null;
          return result;
        }
      });
    }
    return this.connectPromise;
  }

  private async connect(signal?: AbortSignal) {
    const result = await this.request(
      "initialize",
      {
        protocolVersion,
        capabilities: {},
        clientInfo: { name: "halo", version: "1" },
      },
      signal,
    );
    if (result instanceof Error) return result;
    if (this.mcpSessionId === null) {
      return new McpHttpError({
        reason: "Server did not return Mcp-Session-Id",
      });
    }

    const notified = await this.notify("notifications/initialized", signal);
    if (notified instanceof Error) return notified;
  }

  private async request(method: string, params: unknown, signal?: AbortSignal) {
    const id = this.nextId;
    this.nextId += 1;
    const response = await this.post(
      { jsonrpc: "2.0", id, method, params },
      signal,
    );
    if (response instanceof Error) return response;

    const sessionId = response.headers.get("mcp-session-id");
    if (sessionId !== null) this.mcpSessionId = sessionId;

    const body = await readJsonRpcResponse(response);
    if (body instanceof Error) return body;
    if (body.error !== undefined) {
      return new McpHttpError({ reason: body.error.message });
    }
    return body.result;
  }

  private async notify(method: string, signal?: AbortSignal) {
    const response = await this.post({ jsonrpc: "2.0", method }, signal);
    if (response instanceof Error) return response;
  }

  private async post(payload: JsonRpcRequest, signal?: AbortSignal) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": protocolVersion,
    };
    if (this.options.authorization !== undefined) {
      headers.Authorization = this.options.authorization;
    }
    if (this.mcpSessionId !== null) {
      headers["Mcp-Session-Id"] = this.mcpSessionId;
    }

    const response = await fetch(this.options.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal,
    }).catch((e) => new McpHttpError({ reason: "Fetch failed", cause: e }));
    if (response instanceof Error) return response;
    if (!response.ok) {
      return new McpHttpError({
        reason: `HTTP ${String(response.status)}`,
      });
    }
    return response;
  }
}

async function readJsonRpcResponse(response: Response) {
  const raw = await response
    .text()
    .catch(
      (e) => new McpHttpError({ reason: "Failed to read body", cause: e }),
    );
  if (raw instanceof Error) return raw;
  if (raw.length === 0) {
    return { jsonrpc: "2.0" as const, id: 0 };
  }

  const contentType = response.headers.get("content-type");
  const jsonText =
    contentType !== null && contentType.includes("text/event-stream")
      ? sseData(raw)
      : raw;
  if (jsonText instanceof Error) return jsonText;

  const parsed = errore.try({
    try: () => JSON.parse(jsonText) as JsonRpcResponse,
    catch: (e) => new McpHttpError({ reason: "Invalid JSON", cause: e }),
  });
  if (parsed instanceof Error) return parsed;
  return parsed;
}

function sseData(raw: string) {
  const blocks = raw.split("\n\n");
  for (const block of blocks) {
    for (const line of block.split("\n")) {
      if (!line.startsWith("data:")) continue;
      return line.slice("data:".length).trim();
    }
  }
  return new McpHttpError({ reason: "SSE response had no data" });
}

function toolResultText(result: unknown) {
  if (typeof result !== "object" || result === null) {
    return new McpHttpError({ reason: "Tool result was not an object" });
  }
  const callResult = result as CallToolResult;
  if (!Array.isArray(callResult.content)) return "";
  return callResult.content
    .flatMap((part) => {
      if (typeof part !== "object" || part === null) return [];
      const content = part as Partial<McpTextContent>;
      if (content.type !== "text") return [];
      if (typeof content.text !== "string") return [];
      return [content.text];
    })
    .join("");
}
