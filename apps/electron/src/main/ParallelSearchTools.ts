import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  CallToolResultSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";

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
      "HTTP/HTTPS URLs to extract. Up to 20 per request. Use after web_search, or when the user named a URL.",
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
        "Optional keyword queries used with objective to focus excerpts. Pass queries from the prior web_search when applicable.",
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

export function createParallelSearchTools(userId: string): ToolDefinition[] {
  const client = new Client({ name: "halo", version: "1" });
  let connectPromise: Promise<void | ParallelMcpError> | undefined;

  function ensureConnected() {
    if (connectPromise === undefined) {
      connectPromise = client
        .connect(
          new StreamableHTTPClientTransport(new URL(parallelSearchMcpUrl)),
        )
        .catch((e) => new ParallelMcpError({ cause: e }))
        .then((result) => {
          if (result instanceof Error) connectPromise = undefined;
          return result;
        });
    }
    return connectPromise;
  }

  async function callParallelTool(args: {
    name: string;
    modelName: string | undefined;
    arguments: ParallelSearchArgs | ParallelFetchArgs;
    signal: AbortSignal | undefined;
  }) {
    const connected = await ensureConnected();
    if (connected instanceof Error) {
      return {
        content: [{ type: "text" as const, text: connected.message }],
        details: {},
      };
    }

    const toolArguments: ParallelMcpCall = {
      ...args.arguments,
      // Parallel free-tier rate limits by session_id; Halo's user id is that key.
      session_id: userId,
    };
    if (args.modelName !== undefined) {
      toolArguments.model_name = args.modelName;
    }

    const result = await client
      .callTool(
        { name: args.name, arguments: toolArguments },
        CallToolResultSchema,
        { signal: args.signal },
      )
      .catch((e) => new ParallelMcpError({ cause: e }));
    if (result instanceof Error) {
      return {
        content: [{ type: "text" as const, text: result.message }],
        details: {},
      };
    }

    // SAFETY: callTool was invoked with CallToolResultSchema, so the payload is CallToolResult.
    const callResult = result as CallToolResult;
    return {
      content: callResult.content.flatMap((part) => {
        if (part.type !== "text") return [];
        return [{ type: "text" as const, text: part.text }];
      }),
      details: {},
    };
  }

  const webSearch: ToolDefinition = {
    name: "web_search",
    label: "Web search",
    description:
      "Perform web searches and return LLM-friendly results, including excerpts that are usually sufficient to answer directly without a follow-up fetch.",
    promptSnippet:
      "web_search: search the live web; excerpts are usually enough to answer",
    promptGuidelines: [
      "Use web_search first for factual, current-information, research, comparison, documentation, and troubleshooting questions.",
      "Search excerpts are usually enough to answer. Do not fetch every result by default.",
    ],
    parameters: webSearchParameters,
    execute: async (_toolCallId, params, signal, _onUpdate, ctx) => {
      if (!Value.Check(webSearchParameters, params)) {
        return {
          content: [
            { type: "text" as const, text: "Invalid web_search arguments" },
          ],
          details: {},
        };
      }
      return callParallelTool({
        name: "web_search",
        modelName: ctx.model?.id,
        arguments: {
          objective: params.objective,
          search_queries: params.search_queries,
        },
        signal,
      });
    },
  };

  const webFetch: ToolDefinition = {
    name: "web_fetch",
    label: "Web fetch",
    description:
      "Fetch and extract relevant content from specific web URLs. Use only when web_search excerpts are insufficient, or when the user asked about a specific URL.",
    promptSnippet:
      "web_fetch: extract markdown from known URLs when search excerpts are not enough",
    promptGuidelines: [
      "Use web_fetch when the user named a URL, you need exact wording, or search excerpts are conflicting or insufficient.",
    ],
    parameters: webFetchParameters,
    execute: async (_toolCallId, params, signal, _onUpdate, ctx) => {
      if (!Value.Check(webFetchParameters, params)) {
        return {
          content: [
            { type: "text" as const, text: "Invalid web_fetch arguments" },
          ],
          details: {},
        };
      }
      const toolArguments: ParallelFetchArgs = {
        urls: params.urls,
      };
      if (params.objective !== undefined) {
        toolArguments.objective = params.objective;
      }
      if (params.search_queries !== undefined) {
        toolArguments.search_queries = params.search_queries;
      }
      if (params.full_content !== undefined) {
        toolArguments.full_content = params.full_content;
      }
      return callParallelTool({
        name: "web_fetch",
        modelName: ctx.model?.id,
        arguments: toolArguments,
        signal,
      });
    },
  };

  return [webSearch, webFetch];
}
