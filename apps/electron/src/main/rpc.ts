import { RpcTarget } from "capnweb";
import { dialog, type BrowserWindow } from "electron";
import type {
  PromptEventHandler,
  WorkspaceInfo,
} from "../renderer/api/SystemApi.js";
import type { PiService } from "./pi-service.js";
import type { WorkspaceService } from "./workspace-service.js";

/**
 * Main-side Cap'n Web API. Shape can grow toward Pi's createAgentSession →
 * session.subscribe / session.prompt without redesigning PiService yet.
 */
export class HaloRpc extends RpcTarget {
  constructor(
    private readonly workspace: WorkspaceService,
    private readonly pi: PiService,
    private readonly getWindow: () => BrowserWindow,
  ) {
    super();
  }

  getWorkspace(): WorkspaceInfo | null {
    return this.workspace.getWorkspace();
  }

  async chooseWorkspace() {
    const selection = await dialog.showOpenDialog(this.getWindow(), {
      title: "Choose a Halo workspace",
      buttonLabel: "Choose workspace",
      properties: ["openDirectory"],
    });
    if (selection.canceled) return null;
    return this.workspace.select(selection.filePaths[0]!);
  }

  listSessions() {
    return this.pi.listSessions();
  }

  readSessionTranscript(sessionId: string) {
    return this.pi.readTranscript(sessionId);
  }

  createSession() {
    return this.pi.createNewSession();
  }

  createAgentSession(sessionId: string) {
    return new AgentSessionRpc(sessionId, this.pi);
  }
}

type PromptListener = PromptEventHandler & {
  dup?: () => PromptEventHandler & Disposable;
} & Partial<Disposable>;

/**
 * Session stub: subscribe(callback) + prompt/send(text).
 * Temporary stand-in until PiService is flattened to this shape.
 */
export class AgentSessionRpc extends RpcTarget {
  private listeners = new Set<PromptEventHandler>();

  constructor(
    private readonly sessionId: string,
    private readonly pi: PiService,
  ) {
    super();
  }

  subscribe(callback: PromptListener) {
    // Cap'n Web releases arg stubs when the call returns unless we dup().
    const retained =
      typeof callback.dup === "function" ? callback.dup() : callback;
    this.listeners.add(retained);
    return () => {
      this.listeners.delete(retained);
      const dispose = retained[Symbol.dispose];
      if (typeof dispose === "function") dispose.call(retained);
    };
  }

  async prompt(text: string) {
    const pending: Promise<unknown>[] = [];
    const result = await this.pi.sendPrompt(this.sessionId, text, (event) => {
      for (const listener of this.listeners) {
        pending.push(Promise.resolve(listener(event)));
      }
    });
    await Promise.all(pending);
    return result;
  }

  send(text: string) {
    return this.prompt(text);
  }
}
