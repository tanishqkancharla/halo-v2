export type ChatMessage = {
  role: string;
  content?: unknown;
};

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
};

type CompletionDelta = {
  role?: string;
  content?: string;
  tool_calls?: Array<{
    index: number;
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
};

export class ScriptedModel {
  // Records requests so the spike can inspect the real model boundary.
  readonly requests: ChatRequest[] = [];

  // Hosts the local OpenAI-compatible model endpoint.
  private readonly server: Bun.Server<undefined>;

  // Resolves once a deliberately blocked model request reaches the server.
  private blocked = false;

  // Releases the blocked response after OpenCode interrupts its run.
  private releaseBlockedResponse: (() => void) | undefined;

  constructor(ctx: { port: number }) {
    const { port } = ctx;
    this.server = Bun.serve({
      port,
      fetch: (request) => this.respond(request),
    });
  }

  get baseURL() {
    return `http://127.0.0.1:${this.server.port}/v1`;
  }

  get isBlocked() {
    return this.blocked;
  }

  async close() {
    this.releaseBlockedResponse?.();
    await this.server.stop(true);
  }

  releaseBlocked() {
    this.releaseBlockedResponse?.();
  }

  private async respond(request: Request): Promise<Response> {
    // SAFETY: This private test server only receives requests from the configured OpenCode client.
    const input = (await request.json()) as ChatRequest;
    this.requests.push(input);
    const system = messageText(input.messages[0]);
    if (system.includes("title generator")) {
      return textResponse(input.model, ["OpenCode migration spike"]);
    }

    const user = input.messages
      .toReversed()
      .find((message) => message.role === "user");
    const prompt = messageText(user);
    const hasToolResult = input.messages.some(
      (message) => message.role === "tool",
    );
    if (prompt.includes("integration") && !hasToolResult) {
      return toolResponse(input.model, "execute", {
        code: 'return await tools.halo.integration({ operation: "gmail.search" })',
      });
    }
    if (hasToolResult) {
      return textResponse(input.model, ["Executor bridge complete."]);
    }
    if (prompt.includes("block")) return this.block(request, input.model);
    return textResponse(input.model, ["Hello ", "from OpenCode."]);
  }

  private block(request: Request, model: string): Promise<Response> {
    this.blocked = true;
    return new Promise((resolve) => {
      const release = () =>
        resolve(textResponse(model, ["Released after interrupt."]));
      this.releaseBlockedResponse = release;
      request.signal.addEventListener("abort", release, { once: true });
    });
  }
}

export function messageText(message: ChatMessage | undefined) {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- OpenAI message content may be text or structured content.
  if (message === undefined || typeof message.content !== "string") return "";
  return message.content;
}

function textResponse(model: string, text: string[]) {
  const id = crypto.randomUUID();
  return eventStream([
    chunk(id, model, { role: "assistant" }),
    ...text.map((part) => chunk(id, model, { content: part })),
    chunk(id, model, {}, "stop"),
  ]);
}

function toolResponse(model: string, name: string, input: { code: string }) {
  const id = crypto.randomUUID();
  return eventStream([
    chunk(id, model, { role: "assistant" }),
    chunk(id, model, {
      tool_calls: [
        {
          index: 0,
          id: `call_${crypto.randomUUID()}`,
          type: "function",
          function: { name, arguments: JSON.stringify(input) },
        },
      ],
    }),
    chunk(id, model, {}, "tool_calls"),
  ]);
}

function eventStream(chunks: string[]) {
  return new Response(`${chunks.join("")}data: [DONE]\n\n`, {
    headers: { "content-type": "text/event-stream" },
  });
}

function chunk(
  id: string,
  model: string,
  delta: CompletionDelta,
  finishReason?: string,
) {
  return `data: ${JSON.stringify({
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta,
        // oxlint-disable-next-line unicorn/no-null -- OpenAI streaming requires JSON null before the final chunk.
        finish_reason: finishReason === undefined ? null : finishReason,
      },
    ],
  })}\n\n`;
}
