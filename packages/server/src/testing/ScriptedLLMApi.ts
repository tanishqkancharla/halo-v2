import crypto from "node:crypto";
import { EventEmitter, once } from "node:events";
import {
  fauxAssistantMessage,
  fauxProvider,
  type AssistantMessage,
  type Context,
  type SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import * as errore from "errore";
import type { LLMApi } from "../llm/LLMApi.js";

export type LLMRequest = { id: string; context: Context };

class LLMRequestTimeoutError extends errore.createTaggedError({
  name: "LLMRequestTimeoutError",
  message: "No LLM request arrived within 10 seconds",
}) {}

class LLMRequestExpiredError extends errore.createTaggedError({
  name: "LLMRequestExpiredError",
  message: "LLM request $id has already completed or been canceled",
}) {}

type PendingRequest = {
  request: LLMRequest;
  complete(message: AssistantMessage): void;
};

export class ScriptedLLMApi implements LLMApi {
  private readonly faux = fauxProvider({
    api: "halo-scripted",
    provider: "halo-scripted",
    models: [{ id: "scripted", name: "Scripted LLM" }],
    tokenSize: { min: 256, max: 256 },
  });
  readonly model = this.faux.getModel();
  private readonly pending = new Map<string, PendingRequest>();
  private readonly queued: string[] = [];
  private readonly incoming = new EventEmitter();

  stream(context: Context, options?: SimpleStreamOptions) {
    const id = crypto.randomUUID();
    const response = new Promise<AssistantMessage>((resolve) => {
      const complete = (message: AssistantMessage) => {
        options?.signal?.removeEventListener("abort", abort);
        this.pending.delete(id);
        const index = this.queued.indexOf(id);
        if (index !== -1) this.queued.splice(index, 1);
        resolve(message);
      };
      const abort = () =>
        complete(fauxAssistantMessage([], { stopReason: "aborted" }));
      this.pending.set(id, { request: { id, context }, complete });
      this.queued.push(id);
      options?.signal?.addEventListener("abort", abort, { once: true });
      if (options?.signal?.aborted) abort();
    });
    this.faux.appendResponses([() => response]);
    const stream = this.faux.provider.streamSimple(
      this.model,
      context,
      options,
    );
    this.incoming.emit("request");
    return stream;
  }

  async waitForRequest() {
    while (this.queued.length === 0) {
      const received = await once(this.incoming, "request", {
        signal: AbortSignal.timeout(10_000),
      }).catch((cause) => new LLMRequestTimeoutError({ cause }));
      if (received instanceof Error) return received;
    }
  }

  async nextRequest(): Promise<LLMRequest | LLMRequestTimeoutError> {
    const received = await this.waitForRequest();
    if (received instanceof Error) return received;
    const id = this.queued.shift()!;
    return this.pending.get(id)!.request;
  }

  respond(input: { id: string; message: AssistantMessage }) {
    const pending = this.pending.get(input.id);
    if (pending === undefined) return new LLMRequestExpiredError(input);
    pending.complete(input.message);
  }
}
