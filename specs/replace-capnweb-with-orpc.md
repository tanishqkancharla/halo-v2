# Replace Cap'n Web with oRPC

```mermaid
flowchart LR
  subgraph current [Current]
    R1[Renderer] -->|"newMessagePortRpcSession"| P1[MessagePort]
    P1 --> T1[MessagePortMainTransport]
    T1 --> H1["HaloRpc extends RpcTarget"]
    H1 -->|"return RpcTarget"| S1[AgentSessionRpc]
    H1 -->|"return RpcTarget"| G1[plugin server]
    R1 -->|"subscribe callback stub"| S1
    R1 -->|"subscribe callback stub"| H1
  end
```

```mermaid
flowchart LR
  subgraph proposed [Proposed]
    R2[Renderer] -->|"RPCLink + createORPCClient"| P2[MessagePort]
    P2 --> T2["RPCHandler.upgrade"]
    T2 -->|"context: HaloContext"| H2[haloRouter]
    H2 --> A2[agentSession.events iterator]
    H2 --> W2[subscribeWorkspaceTree iterator]
    H2 -->|"router.plugins id"| G2[plugin router]
    G2 -->|"injected context"| C2[PluginServerContext]
  end
```

## Problem overview

Halo talks between the Electron renderer and main process with Cap'n Web. The API is a tree of `RpcTarget` objects: `HaloRpc` on the port, live `AgentSessionRpc` objects returned from `newAgentSession` / `openAgentSession`, plugin classes nested under `getPlugin`, and renderer callbacks passed into `subscribe`. That model needs a custom `MessagePortMain` transport, `dup()` on callback stubs, and a prototype-copy wrapper so jiti-loaded plugin `RpcTarget` classes match the bundled Cap'n Web copy.

## Solution overview

Replace Cap'n Web with oRPC v2 over the same Electron MessagePort handshake. Main services live in oRPC initial context (`HaloContext`), provided at `RPCHandler.upgrade`. Procedures are a contract in `src/shared` and an implementer in main. Live session objects become `sessionId` plus procedures. Callbacks become `AsyncIteratorObject` streams. Plugin servers export an oRPC router; `listPlugins` writes those routers onto a mutable `plugins` map on the host router and middleware injects `PluginServerContext`.

Cap'n Web object capabilities do not carry over. Plugin classes, instances, and parent-class method walking go away. oRPC v2 is the `@beta` line on [v2.orpc.dev](https://v2.orpc.dev).

Assumption: `RPCHandler` looks up `router.plugins[id]` at call time, so filling a stable `plugins` object during `listPlugins` is enough. Do not snapshot the plugin map at upgrade. If a call lands before `listPlugins`, the procedure is missing and oRPC returns its normal not-found error.

Assumption: the default `RPCSerializer` is enough for Pi `AgentSessionEvent` values and plugin results. Do not turn on `experimental_transfer` unless a payload fails a round-trip.

## Goals

- Renderer and main keep the same MessagePort request/provide channels. Only the session on the port changes.
- Workspace, sessions list, app update, plugin list, agent prompt, and plugin views keep working through the new client.
- Main handlers read `WorkspaceService`, `PiService`, `PluginService`, `AgentSessionRegistry`, `getWindow`, and `logger` from `HaloContext`.
- Plugin servers are oRPC routers. `usePluginServer` returns a typed `RouterClient`. `PluginServerContext` is injected context.
- Agent session events and workspace tree events stream with `AsyncIteratorObject`. `agentSession.close` and MessagePort close drop the live Pi session. Cancelling the events iterator only unsubscribes.
- `capnweb` leaves `@halo/desktop` and `@halo/plugin-sdk`. `MessagePortMainTransport` and `HaloRpc` / `AgentSessionRpc` classes go away.

## Non-goals

- No migrations or backfills.
- No Zod. Procedure I/O uses oRPC `type<T>()`. TypeBox stays for JSON documents and the plugin manifest.
- No OpenAPI handler, no TanStack Query oRPC adapter, no `@orpc/publisher`.
- No dual Cap'n Web / oRPC session. No plugin `RpcTarget` class, instance, or superclass-method support.
- No change to Pi, workspace files, or the preload log bridge.

## Important files, docs, and websites

- [`apps/electron/src/shared/rpc.ts`](../apps/electron/src/shared/rpc.ts) — `HaloApi` / `AgentSessionApi` `RpcTarget` types and DTOs. Keep DTOs; drop the classes.
- [`apps/electron/src/main/rpc.ts`](../apps/electron/src/main/rpc.ts) — today's `HaloRpc` / `AgentSessionRpc`. Replace with an implementer router.
- [`apps/electron/src/main/MessagePortMainTransport.ts`](../apps/electron/src/main/MessagePortMainTransport.ts) — delete after the switch.
- [`apps/electron/src/main/main.ts`](../apps/electron/src/main/main.ts) — `registerRpcBridge` creates the port and attaches `HaloRpc`.
- [`apps/electron/src/main/preload.ts`](../apps/electron/src/main/preload.ts) — forwards `RPC_CHANNELS`; keep the handshake.
- [`apps/electron/src/renderer/api/HaloRpcClient.ts`](../apps/electron/src/renderer/api/HaloRpcClient.ts) — `newMessagePortRpcSession`.
- [`apps/electron/src/renderer/api/ApiProvider.tsx`](../apps/electron/src/renderer/api/ApiProvider.tsx) — queries call `HaloApi` methods and `getPlugin`.
- [`apps/electron/src/renderer/agentSession/useAgentSession.ts`](../apps/electron/src/renderer/agentSession/useAgentSession.ts) — live stub, `subscribe`, `Symbol.dispose`.
- [`apps/electron/src/renderer/patterns/WorkspaceFilesystem.tsx`](../apps/electron/src/renderer/patterns/WorkspaceFilesystem.tsx) — `subscribeWorkspaceTree` callback.
- [`packages/plugin-sdk/src/server.ts`](../packages/plugin-sdk/src/server.ts) — re-exports `RpcTarget`.
- [`packages/plugin-sdk/src/view.ts`](../packages/plugin-sdk/src/view.ts) — `usePluginServer<S extends RpcTarget>()`.
- [`apps/electron/src/main/plugins/loadPluginServer.ts`](../apps/electron/src/main/plugins/loadPluginServer.ts) — jiti + `instanceof RpcTarget`.
- [`apps/electron/src/main/plugins/PluginService.ts`](../apps/electron/src/main/plugins/PluginService.ts) — `wrapPluginRpc` copies methods onto a host `RpcTarget`.
- [`apps/electron/src/main/plugins/PluginService.test.ts`](../apps/electron/src/main/plugins/PluginService.test.ts) — MessagePort round-trip and loader fixtures.
- [`apps/electron/src/main/plugins/haloPluginSkill.md`](../apps/electron/src/main/plugins/haloPluginSkill.md) — seeded plugin skill.
- [`apps/electron/mainExternals.ts`](../apps/electron/mainExternals.ts) — `pluginSdkJitiDependencies` includes `capnweb`.
- [`apps/electron/src/main/copyMainProcessExternals.test.ts`](../apps/electron/src/main/copyMainProcessExternals.test.ts) — packaged jiti load of `RpcTarget`.
- [oRPC context](https://v2.orpc.dev/docs/context) — `$context` initial context and middleware-injected context.
- [oRPC contract implementation](https://v2.orpc.dev/docs/contract/implementation) — `implement(contract).$context<...>()` then `.handler` / `.router`.
- [oRPC Message Port adapter](https://v2.orpc.dev/docs/adapters/message-port) — `RPCHandler` + `RPCLink`; `upgrade` can take a per-call `context` function.
- [oRPC Electron adapter](https://v2.orpc.dev/docs/adapters/electron) — same MessagePort pieces; Halo already creates the channel in main, keep that direction.
- [AsyncIteratorObject](https://v2.orpc.dev/docs/async-iterator-object) and [client consumption](https://v2.orpc.dev/docs/client/async-iterator-object) — replace Cap'n Web callbacks.
- [oRPC `type` utility](https://v2.orpc.dev/docs/procedure#type-utility) — TypeScript-only schemas, no Zod.
- [oRPC error handling](https://v2.orpc.dev/docs/error-handling) — return `ORPCError` at the handler boundary.
- [oRPC RPC serializer](https://v2.orpc.dev/docs/rpc/serializer) — default codec already carries `Date` and `undefined`.

## Implementation

### Phase 1: Add oRPC packages and the Halo contract

Install the v2 beta packages and write the renderer/main shared contract. The app still uses Cap'n Web.

#### Important types

```ts
// apps/electron/src/shared/haloContract.ts
import { asyncIteratorObject, oc, type } from "@orpc/contract";
import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import type { AgentSessionState } from "./AgentSessionState.js";
import type {
  AppInfo,
  PluginList,
  SessionSummary,
  WorkspaceInfo,
  WorkspaceTreeEvent,
} from "./rpc.js";

export const haloContract = {
  getAppInfo: oc.output(type<AppInfo>()),
  installAppUpdate: oc,
  getWorkspace: oc.output(type<WorkspaceInfo | undefined>()),
  chooseWorkspace: oc.output(type<WorkspaceInfo | undefined>()),
  listSessions: oc.output(type<SessionSummary[]>()),
  listWorkspacePaths: oc.output(type<string[]>()),
  listPlugins: oc.output(type<PluginList>()),
  subscribeWorkspaceTree: oc.output(
    asyncIteratorObject(type<WorkspaceTreeEvent[]>()),
  ),
  newAgentSession: oc.output(type<{ sessionId: string }>()),
  openAgentSession: oc
    .input(type<{ sessionId: string }>())
    .output(type<{ sessionId: string; state: AgentSessionState }>()),
  agentSession: {
    events: oc
      .input(type<{ sessionId: string }>())
      .output(asyncIteratorObject(type<AgentSessionEvent>())),
    prompt: oc.input(type<{ sessionId: string; text: string }>()),
    close: oc.input(type<{ sessionId: string }>()),
  },
};

export type HaloContract = typeof haloContract;
```

#### Call stack diff

```diff
 renderer tsconfig includes src/shared
 shared/rpc.ts
-└── HaloApi / AgentSessionApi extends RpcTarget
+└── DTO types only
+└── shared/haloContract.ts
+    └── oc procedure contracts
```

#### Code diff preview

```diff
 // apps/electron/package.json
   "dependencies": {
     "capnweb": "^0.10.0",
     "@halo/plugin-sdk": "workspace:*",
+    "@orpc/client": "beta",
+    "@orpc/contract": "beta",
+    "@orpc/server": "beta",

 // packages/plugin-sdk/package.json
   "dependencies": {
     "capnweb": "^0.10.0",
+    "@orpc/client": "beta",
+    "@orpc/server": "beta",
```

Leave `capnweb` installed until the cutover so the running app still links.

- [ ] Add `@orpc/server@beta`, `@orpc/client@beta`, and `@orpc/contract@beta` to `@halo/desktop`. Add `@orpc/server@beta` and `@orpc/client@beta` to `@halo/plugin-sdk`.
- [ ] Add `apps/electron/src/shared/haloContract.ts` with the contract above. Keep DTO types in `rpc.ts`.
- [ ] Export `HaloClient` as `RouterContractClient<typeof haloContract>` from `haloContract.ts`.
- [ ] Run `pnpm --filter @halo/desktop typecheck` and confirm the new file typechecks. Cap'n Web code still compiles.

### Phase 2: HaloContext and data procedures

Implement the query and mutation procedures on an unused router. Handlers read services from initial context. Test them with oRPC `call` and a real `WorkspaceService`.

#### Important types

```ts
// apps/electron/src/main/HaloContext.ts
import type { BrowserWindow } from "electron";
import type { Logger } from "@repo/logger";
import type { PluginService } from "./plugins/PluginService.js";
import type { PiService } from "./pi-service.js";
import type { WorkspaceService } from "./workspace-service.js";
import type { AgentSessionRegistry } from "./AgentSessionRegistry.js";

export type HaloContext = {
  workspace: WorkspaceService;
  pi: PiService;
  plugins: PluginService;
  sessions: AgentSessionRegistry;
  getWindow: () => BrowserWindow;
  logger: Logger;
};
```

#### Call stack diff

```diff
 HaloRpc.getAppInfo / getWorkspace / listSessions / ...
-└── this.workspace / this.pi / this.plugins
+implement(haloContract).$context<HaloContext>()
+└── procedure.handler({ context })
+    └── context.workspace / context.pi / context.plugins
+call(procedure, input, { context })  // tests
```

#### Code diff preview

```diff
 // apps/electron/src/main/haloRouter.ts
+import { ORPCError, implement } from "@orpc/server";
+import { haloContract } from "../shared/haloContract.js";
+import type { HaloContext } from "./HaloContext.js";
+
+const halo = implement(haloContract).$context<HaloContext>();
+
+export const getAppInfo = halo.getAppInfo.handler(({ context }) => {
+  context.logger.info({ event: "getAppInfo" });
+  return getAppInfoFromUpdate();
+});
+
+export const listSessions = halo.listSessions.handler(async ({ context }) => {
+  const sessions = await context.pi.listSessions();
+  if (sessions instanceof Error) {
+    return new ORPCError("BAD_REQUEST", {
+      message: sessions.message,
+      cause: sessions,
+    });
+  }
+  return sessions;
+});
+
+export function createHaloRouter() {
+  return halo.router({
+    getAppInfo,
+    installAppUpdate,
+    getWorkspace,
+    chooseWorkspace,
+    listSessions,
+    listWorkspacePaths,
+    listPlugins,
+    subscribeWorkspaceTree, // stub throw until phase 3
+    newAgentSession,
+    openAgentSession,
+    agentSession: { events, prompt, close },
+  });
+}
```

For this phase, agent-session and tree procedures may `return new ORPCError("NOT_IMPLEMENTED")`. `listPlugins` still calls `PluginService.list` and returns the DTO; it does not yet mount plugin routers.

`chooseWorkspace` keeps `dialog.showOpenDialog(context.getWindow(), ...)`. Convert a returned tagged error to `ORPCError` the same way `HaloRpc` throws today. Do not add retries or extra guards.

- [ ] Add `HaloContext` and `createHaloRouter` in main. Put `AgentSessionRegistry` in as an empty class with `get` / `add` / `close` / `closeAll` no-ops if the session procedures are stubs.
- [ ] Move the bodies of `HaloRpc` data methods into the matching handlers. Keep `HaloRpc` working for the live app.
- [ ] Add `apps/electron/src/main/haloRouter.test.ts` with a Vitest fixture that builds a real `WorkspaceService` (same temp-dir pattern as `PluginService.test.ts`) and a `HaloContext`. Use `call` from `@orpc/server`.
- [ ] Commit a test that `call(getWorkspace, undefined, { context })` returns `undefined` before `select`, then the workspace info after `select`. Also assert `listPlugins` before a workspace is chosen returns an `ORPCError` whose cause is `WorkspaceNotReadyError`.
- [ ] Run `pnpm --filter @halo/desktop test` and `pnpm --filter @halo/desktop typecheck`.

### Phase 3: Agent sessions and workspace tree as iterators

Own live Pi sessions in `AgentSessionRegistry` (one registry per RPC connection). Stream Pi events and tree events as async generators. `PiService` stays the same.

#### Important types

```ts
// apps/electron/src/main/AgentSessionRegistry.ts
import type { AgentSession } from "@mariozechner/pi-coding-agent";

export class SessionNotOpenError extends errore.createTaggedError({
  name: "SessionNotOpenError",
  message: "Agent session '$sessionId' is not open.",
}) {}

export class AgentSessionRegistry {
  private readonly sessions = new Map<string, AgentSession>();

  add(session: AgentSession): void;
  get(sessionId: string): SessionNotOpenError | AgentSession;
  close(sessionId: string): SessionNotOpenError | undefined;
  closeAll(): void;
}
```

#### Call stack diff

```diff
 renderer useAgentSession
-└── api.openAgentSession(id) -> { session: AgentSessionRpc, state }
-    └── session.subscribe(callback.dup())
-    └── session.prompt(text)
-    └── session[Symbol.dispose]()
+└── client.openAgentSession({ sessionId }) -> { sessionId, state }
+    └── client.agentSession.events({ sessionId })
+        └── for await (event of iterator)
+    └── client.agentSession.prompt({ sessionId, text })
+    └── client.agentSession.close({ sessionId })
+        └── AgentSessionRegistry.close -> session.abort / dispose

 renderer WorkspaceFilesystem
-└── api.subscribeWorkspaceTree(callback)
+└── for await (events of await client.subscribeWorkspaceTree())
```

#### Code diff preview

```diff
 // apps/electron/src/main/haloRouter.ts
   newAgentSession: halo.newAgentSession.handler(async ({ context }) => {
     const session = await context.pi.newAgentSession();
     if (session instanceof Error) {
       return new ORPCError("BAD_REQUEST", {
         message: session.message,
         cause: session,
       });
     }
+    context.sessions.add(session);
+    return { sessionId: session.sessionId };
   }),

   agentSession: {
     events: halo.agentSession.events.handler(async function* ({
       input,
       context,
       signal,
     }) {
+      const session = context.sessions.get(input.sessionId);
+      if (session instanceof Error) {
+        return new ORPCError("BAD_REQUEST", {
+          message: session.message,
+          cause: session,
+        });
+      }
+      const queue = new AsyncEventQueue<AgentSessionEvent>();
+      const unsubscribe = session.subscribe((event) => queue.push(event));
+      try {
+        while (signal === undefined || !signal.aborted) {
+          yield await queue.next(signal);
+        }
+      } finally {
+        unsubscribe();
+      }
     }),
   }

   subscribeWorkspaceTree: halo.subscribeWorkspaceTree.handler(
     async function* ({ context, signal }) {
+      const queue = new AsyncEventQueue<WorkspaceTreeEvent[]>();
+      context.workspace.setTreeListener((events) => queue.push(events));
+      try {
+        while (signal === undefined || !signal.aborted) {
+          yield await queue.next(signal);
+        }
+      } finally {
+        context.workspace.setTreeListener(undefined);
+      }
     },
   );
```

Keep one tree listener, matching `HaloRpc` today. `AgentSessionRegistry.close` unsubscribes, aborts, and `dispose`s the Pi session the way `AgentSessionRpc[Symbol.dispose]` does. `prompt` still rejects empty text with `EmptyPromptError` converted to `ORPCError`. Await in-flight event deliveries before `prompt` returns, same as `AgentSessionRpc.deliveries`.

`newAgentSession` returns `{ sessionId }` immediately. The draft UI can still wait until the first prompt finishes before navigating; it no longer calls `getSessionId`.

- [ ] Implement `AgentSessionRegistry` and a small async queue used by both generators. Put cleanup in `finally`.
- [ ] Implement `newAgentSession`, `openAgentSession`, `agentSession.events` / `prompt` / `close`, and `subscribeWorkspaceTree`.
- [ ] Extend `haloRouter.test.ts`: open a session via `call`, `prompt` with `""`, and assert an `ORPCError` whose message matches `EmptyPromptError`. `close` then `prompt` must fail with `SessionNotOpenError`.
- [ ] Smoke by hand: `call(subscribeWorkspaceTree)`, push one tree event through `WorkspaceService.setTreeListener` by writing a file in the selected workspace, then `iterator.return()`. Do not commit this filesystem watch unless it stays short and stable in the existing fixture.
- [ ] Run `pnpm --filter @halo/desktop test`.

### Phase 4: Cut over MessagePort, plugins, and the renderer

Switch the live session from Cap'n Web to oRPC. Change the plugin SDK and loader in the same commit so the app never runs with mixed RPC models.

Plugin servers export a router. `listPlugins` writes `router.plugins[id]`. Middleware injects `PluginServerContext` and converts a returned `Error` to `ORPCError`.

#### Important types

```ts
// packages/plugin-sdk/src/server.ts
import { os } from "@orpc/server";

export { os, type } from "@orpc/server";

export type PluginServerContext = {
  pluginId: string;
  workspaceRoot: string;
};

export const pluginOs = os.$context<PluginServerContext>();

// packages/plugin-sdk/src/view.ts
import type { RouterClient } from "@orpc/server";

export type PluginRuntimeValue = {
  pluginId: string;
  server?: RouterClient<AnyRouter>;
};

export function usePluginServer<T extends AnyRouter>(): RouterClient<T>;

// apps/electron/src/shared/haloContract.ts (client widening)
export type HaloClient = RouterContractClient<typeof haloContract> & {
  plugins: Record<string, RouterClient<AnyRouter>>;
};
```

#### Call stack diff

```diff
 registerRpcBridge
-└── new MessageChannelMain
-    └── newMessagePortMainRpcSession(port1, new HaloRpc(...))
-    └── frame.postMessage(provideRpc, null, [port2])
+└── new MessageChannelMain
+    └── RPCHandler(createHaloRouter(pluginMap)).upgrade(port1, { context })
+    └── frame.postMessage(provideRpc, null, [port2])

 connectHaloRpc
-└── newMessagePortRpcSession<HaloApi>(port)
+└── RPCLink({ port })
+    └── createORPCClient(link) as HaloClient

 PluginService.list
-└── loadPluginServer -> instanceof RpcTarget
-    └── wrapPluginRpc copies methods, throws returned Error
-└── HaloRpc.getPlugin returns RpcTarget
+└── loadPluginServer -> default | router export (plain object)
+    └── mountPluginRouter injects PluginServerContext
+    └── pluginMap[id] = mounted router
+└── client.plugins[id].ping()

 useAgentSession / WorkspaceFilesystem / ApiProvider
-└── HaloApiStub RpcStub methods
+└── HaloClient procedures and iterators
```

#### Code diff preview

```diff
 // apps/electron/src/main/main.ts
-    newMessagePortMainRpcSession(
-      port1,
-      new HaloRpc(workspaceService, piService, pluginService, getWindow, rpcLogger),
-    );
+    const pluginMap: Record<string, AnyRouter> = {};
+    const handler = new RPCHandler(createHaloRouter(pluginMap), {
+      interceptors: [onError((error) => rpcLogger.warn({ event: "orpc", error }))],
+    });
+    const sessions = new AgentSessionRegistry();
+    handler.upgrade(port1, {
+      context: () => ({
+        workspace: workspaceService,
+        pi: piService,
+        plugins: pluginService,
+        sessions,
+        getWindow,
+        logger: rpcLogger,
+      }),
+    });
+    port1.start();
+    port1.on("close", () => sessions.closeAll());

 // apps/electron/src/renderer/api/HaloRpcClient.ts
-import { newMessagePortRpcSession, type RpcStub } from "capnweb";
-export async function connectHaloRpc(): Promise<HaloApiStub> {
-  const port = await requestRpcPort();
-  return newMessagePortRpcSession<HaloApi>(port);
-}
+import { createORPCClient } from "@orpc/client";
+import { RPCLink } from "@orpc/client/message-port";
+import type { HaloClient } from "../../shared/haloContract.js";
+export async function connectHaloRpc(): Promise<HaloClient> {
+  const port = await requestRpcPort();
+  const link = new RPCLink({ port });
+  port.start();
+  return createORPCClient(link);
+}

 // plugin server (skill + tests)
-export default class PingServer extends RpcTarget {
-  constructor(private readonly ctx: PluginServerContext) { super(); }
-  ping() { return { pluginId: this.ctx.pluginId }; }
-}
+const plugin = pluginOs;
+export default {
+  ping: plugin.handler(async ({ context }) => ({
+    pluginId: context.pluginId,
+  })),
+};
```

`createHaloRouter(pluginMap)` returns `{ ...implemented, plugins: pluginMap }`. `listPlugins` clears `pluginMap`, loads routers, and assigns `pluginMap[id] = mountPluginRouter(...)`. Do not replace the `pluginMap` object.

`loadPluginServer` accepts `default` or named `router` / `Server` if the value is a plain router object (nested objects of procedures). A function or class is a load error: `server must export an oRPC router`. Drop instance exports and `instanceof RpcTarget`. Detect procedures with oRPC `isProcedure` (or the equivalent public helper in `@orpc/server`).

`mountPluginRouter` wraps with `$context<HaloContext>()`, injects `{ pluginId, workspaceRoot }`, and if `next()` returns an `Error` that is not already an `ORPCError`, returns `new ORPCError("PLUGIN_ERROR", { message, cause })`.

Renderer: `usePluginsQuery` sets `servers[id] = api.plugins[id]` with no await. `useAgentSession` uses `openAgentSession` + `events` + `prompt` + `close`. `useDraftAgentSession` uses `newAgentSession` then the same sessionId. `WorkspaceFilesystem` consumes the tree iterator and calls `return()` on cleanup.

Delete `MessagePortMainTransport.ts`, `HaloRpc`, `AgentSessionRpc`, `RpcTarget` exports, and the `capnweb` dependency. Replace `capnweb` in `pluginSdkJitiDependencies` with `@orpc/server` (copy the package closure). Update `haloPluginSkill.md` and the copy-externals test to load `os` / `pluginOs` instead of `RpcTarget`.

Keep `RPC_CHANNELS` and the main-created `MessageChannelMain`. oRPC's Electron doc sends the port from the renderer; Halo already does the reverse and that stays.

- [ ] Switch main, preload comment, renderer client, `ApiProvider`, agent-session hooks, filesystem subscribe, `App` / `Sidebar` / `MainPane` plugin server types, plugin SDK, loader, `PluginService`, skill, externals, and tests in this commit.
- [ ] Rewrite `PluginService.test.ts` fixtures to export oRPC routers. Keep the MessagePort round-trip: `RPCHandler.upgrade(port1)` + `RPCLink` on `port2` + `createORPCClient`. Assert `client.plugins.calendar.ping()` returns `{ pluginId: "calendar" }`, `fail()` rejects, and `client.plugins.missing.ping()` rejects.
- [ ] Rewrite loader tests: named `router` / `Server` object exports succeed; a class or function export records a load error matching `must export an oRPC router`.
- [ ] Smoke the running app: `pnpm halo-web status`, then `pnpm halo-web exec` that `sessions-shell` is visible and Calendar is in the snapshot. Do not commit this check.
- [ ] Run `pnpm run check-affected`.

Plugin ids must not be oRPC reserved router keys (`then`, `bind`, `valueOf`, `toString`, `toJSON`). Folder names in `.halo/plugins` already avoid those.

## Testing

Until phase 2, checks are typecheck only. Phase 2 commits `haloRouter.test.ts` that calls procedures through `call` with a real `WorkspaceService`. Phase 3 extends that file for empty prompt and closed session. Phase 4 commits the MessagePort plugin round-trip (the package-level stand-in for Cap'n Web's current test) and relies on `pnpm run check-affected`.

Do not mock `PiService` or `PluginService`. Do not add `vi.fn`. Drive the live Halo window with `pnpm halo-web` as an uncommitted smoke step after the cutover.

```sh
pnpm --filter @halo/desktop typecheck
pnpm --filter @halo/desktop test
pnpm run check-affected
pnpm halo-web status
pnpm halo-web exec "return await page.getByTestId('sessions-shell').isVisible()"
```
