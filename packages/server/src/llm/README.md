# Inference dependency

`HaloServer.start({ llmApi, ... })` requires an `LLMApi` supplied by its host. It creates one Pi `ModelRuntime` backed by that API and shares it across sessions. Sessions do not discover providers, select a default model, or load model credentials.

`LLMApi` exposes the assigned model's metadata and `stream(context, options)`, using Pi's existing message and event types. The implementation owns inference transport and authentication. Forward cancellation through `options.signal`. Halo continues to own tools, permissions, conversation state, and persistence. There is no model-selection or model-list API yet.

Without `HALO_LLM_CONFIG`, the desktop bootstrap uses `createPiLLMApi({ agentDir, provider, modelId })` in both development and production. This temporary backend uses local Pi credentials and the workspace's `models.json`; the model is selected explicitly by the bootstrap. It is the only layer that should discover local inference configuration. The adapter above `LLMApi` uses in-memory Pi configuration and does not read those files.

When a control-plane inference service is available, its client can implement `LLMApi` and be supplied by the VM bootstrap. It should obtain the assigned model from the control plane and send inference there; authorization must be enforced by the control plane on each request. No control-plane transport is implemented here.

`createOpenAILLMApi({ model, apiKey })` implements `LLMApi` using Pi's OpenAI Chat Completions client. The supplied model includes `baseUrl` and its capabilities and limits. Desktop hosts can set `HALO_LLM_CONFIG` to a JSON-encoded `OpenAILLMApiOptions` object to select this transport. The bootstrap passes it directly to the factory. Inference cancellation is forwarded to the HTTP request.

Server tests can inject `ScriptedLLMApi` from `@get-halo/server/testing` directly. It uses Pi's faux provider to emit message streams in process. Electron E2Es instead own an OpenAI-compatible HTTP endpoint in the harness and supply its configuration through the launch environment. The ordinary `llm` fixture responds to real pending HTTP requests and survives Electron restarts. There are no LLM test event handlers in main. Neither scripting API injects session history or tool results.
