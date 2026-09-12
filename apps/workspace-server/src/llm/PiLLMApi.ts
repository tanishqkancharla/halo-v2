import { join } from "node:path";
import { registerBunOAuthFlows } from "@earendil-works/pi-ai/bun-oauth";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import * as errore from "errore";
import type { LLMApi } from "./LLMApi.js";

class PiLLMApiError extends errore.createTaggedError({
  name: "PiLLMApiError",
  message: "Could not initialize local Pi inference for $provider/$modelId",
}) {}

export async function createPiLLMApi(options: {
  agentDir: string;
  provider: string;
  modelId: string;
  apiKey: string;
}): Promise<LLMApi | PiLLMApiError> {
  registerBunOAuthFlows();
  const runtime = await ModelRuntime.create({
    modelsPath: join(options.agentDir, "models.json"),
  }).catch((cause) => new PiLLMApiError({ ...options, cause }));
  if (runtime instanceof Error) return runtime;
  const authenticated = await runtime
    .setRuntimeApiKey(options.provider, options.apiKey)
    .catch((cause) => new PiLLMApiError({ ...options, cause }));
  if (authenticated instanceof Error) return authenticated;
  const model = runtime.getModel(options.provider, options.modelId);
  if (model === undefined) return new PiLLMApiError(options);
  return {
    model,
    stream: (context, streamOptions) =>
      runtime.streamSimple(model, context, streamOptions),
  };
}
