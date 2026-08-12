import type {
  ExtensionContext,
  ToolDefinition,
} from "@mariozechner/pi-coding-agent";
import { type Static, Type } from "@sinclair/typebox";
import type { McpHttpClient } from "./McpHttpClient.js";

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

export function createParallelSearchTools(args: {
  client: McpHttpClient;
  userId: string;
}): ToolDefinition[] {
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
      const search = params as Static<typeof webSearchParameters>;
      return callParallelTool({
        client: args.client,
        name: "web_search",
        userId: args.userId,
        modelName: modelName(ctx),
        arguments: {
          objective: search.objective,
          search_queries: search.search_queries,
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
      const fetchParams = params as Static<typeof webFetchParameters>;
      const toolArguments: Record<string, unknown> = {
        urls: fetchParams.urls,
      };
      if (fetchParams.objective !== undefined) {
        toolArguments.objective = fetchParams.objective;
      }
      if (fetchParams.search_queries !== undefined) {
        toolArguments.search_queries = fetchParams.search_queries;
      }
      if (fetchParams.full_content !== undefined) {
        toolArguments.full_content = fetchParams.full_content;
      }
      return callParallelTool({
        client: args.client,
        name: "web_fetch",
        userId: args.userId,
        modelName: modelName(ctx),
        arguments: toolArguments,
        signal,
      });
    },
  };

  return [webSearch, webFetch];
}

async function callParallelTool(args: {
  client: McpHttpClient;
  name: string;
  userId: string;
  modelName: string | null;
  arguments: Record<string, unknown>;
  signal: AbortSignal | undefined;
}) {
  const toolArguments: Record<string, unknown> = {
    ...args.arguments,
    // Parallel free-tier rate limits by session_id; Halo's user id is that key.
    session_id: args.userId,
  };
  if (args.modelName !== null) {
    toolArguments.model_name = args.modelName;
  }

  const text = await args.client.callTool({
    name: args.name,
    arguments: toolArguments,
    signal: args.signal,
  });
  if (text instanceof Error) {
    return {
      content: [{ type: "text" as const, text: text.message }],
      details: {},
    };
  }
  return {
    content: [{ type: "text" as const, text }],
    details: {},
  };
}

function modelName(ctx: ExtensionContext) {
  if (ctx.model === undefined) return null;
  return ctx.model.id;
}
