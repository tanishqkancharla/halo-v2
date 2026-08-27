import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  CallToolResultSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { type Static, Type } from "@sinclair/typebox";
import * as errore from "errore";
import {
  defineHaloTool,
  type HaloToolContext,
  type HaloToolPlugin,
} from "../HaloToolPlugin.js";

class ParallelMcpError extends errore.createTaggedError({
  name: "ParallelMcpError",
  message: "Parallel MCP request failed",
}) {}

const parallelSearchMcpUrl = "https://search.parallel.ai/mcp";

const webSearchParameters = Type.Object({
  objective: Type.String({
    description:
      "Natural-language description of what the web search is trying to find. Keep it atomic. May include preferred sources or freshness.",
  }),
  search_queries: Type.Array(Type.String(), {
    description:
      "Concise keyword search queries, 3-6 words each. At least one is required; provide 2-3 for best results. Batch related angles in one call.",
  }),
});

const webFetchParameters = Type.Object({
  urls: Type.Array(Type.String(), {
    description:
      "HTTP/HTTPS URLs to extract. Up to 20 per request. Use after web.search, or when the user named a URL.",
  }),
  objective: Type.Optional(
    Type.String({
      description:
        "What to extract from the URLs. Limit to 200 characters. Focuses excerpts on the relevant parts.",
    }),
  ),
  search_queries: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Optional keyword queries used with objective to focus excerpts. Pass queries from the prior web.search when applicable.",
    }),
  ),
  full_content: Type.Optional(
    Type.Boolean({
      description:
        "Leave off unless you need the entire page as markdown. Default excerpts are smaller and usually enough.",
    }),
  ),
});

type ParallelSearchArgs = Static<typeof webSearchParameters>;
type ParallelFetchArgs = Static<typeof webFetchParameters>;

type ParallelMcpCall = {
  objective?: string;
  search_queries?: string[];
  urls?: string[];
  full_content?: boolean;
  session_id: string;
  model_name?: string;
};

export function createParallelSearchPlugin(input: {
  userId: string;
}): HaloToolPlugin {
  const client = new Client({ name: "halo", version: "1" });
  let connectPromise: Promise<void | ParallelMcpError> | undefined;
  let connected = false;

  function ensureConnected() {
    if (connectPromise === undefined) {
      connectPromise = client
        .connect(
          new StreamableHTTPClientTransport(new URL(parallelSearchMcpUrl)),
        )
        .catch((e) => new ParallelMcpError({ cause: e }))
        .then((result) => {
          if (result instanceof Error) {
            connectPromise = undefined;
            return result;
          }
          connected = true;
          return result;
        });
    }
    return connectPromise;
  }

  async function callParallelTool(args: {
    name: string;
    arguments: ParallelSearchArgs | ParallelFetchArgs;
    context: HaloToolContext;
  }) {
    const connection = await ensureConnected();
    if (connection instanceof Error) return connection;

    const toolArguments: ParallelMcpCall = {
      ...args.arguments,
      // Parallel free-tier rate limits by session_id; Halo's user id is that key.
      session_id: input.userId,
    };
    if (args.context.modelId !== undefined) {
      toolArguments.model_name = args.context.modelId;
    }

    const result = await client
      .callTool(
        { name: args.name, arguments: toolArguments },
        CallToolResultSchema,
        { signal: args.context.signal },
      )
      .catch((e) => new ParallelMcpError({ cause: e }));
    if (result instanceof Error) return result;

    // SAFETY: callTool was invoked with CallToolResultSchema, so the payload is CallToolResult.
    const callResult = result as CallToolResult;
    return {
      value: callResult.content
        .flatMap((part) => (part.type === "text" ? [part.text] : []))
        .join("\n"),
    };
  }

  return {
    id: "web",
    name: "Web",
    tools: [
      defineHaloTool({
        name: "search",
        description:
          "Search the live web and return relevant excerpts. Search excerpts are usually enough to answer without fetching each result.",
        inputSchema: webSearchParameters,
        requiredCapabilities: ["network.web.search"],
        execute: (args, context) =>
          callParallelTool({
            name: "web_search",
            arguments: args,
            context,
          }),
      }),
      defineHaloTool({
        name: "fetch",
        description:
          "Fetch and extract content from specific web URLs when search excerpts are insufficient or the user named a URL.",
        inputSchema: webFetchParameters,
        requiredCapabilities: ["network.web.search"],
        execute: (args, context) =>
          callParallelTool({
            name: "web_fetch",
            arguments: args,
            context,
          }),
      }),
    ],
    close: async () => {
      if (!connected) return;
      connected = false;
      return client
        .close()
        .then(() => undefined)
        .catch((e) => new ParallelMcpError({ cause: e }));
    },
  };
}
