import type { MessagePortMain } from "electron";
import {
  RpcSession,
  type RpcSessionOptions,
  type RpcStub,
  type RpcTransportWithCustomEncoding,
} from "capnweb";
import * as errore from "errore";

type StructuredCloneMessage =
  | string
  | number
  | boolean
  | bigint
  | ArrayBuffer
  | Uint8Array
  | Date
  | RegExp
  | Error
  | readonly StructuredCloneMessage[]
  | { readonly [key: string]: StructuredCloneMessage };

/**
 * Cap'n Web session over Electron's MessagePortMain.
 * Mirrors capnweb's MessagePortTransport, but uses the Node-style EventEmitter API.
 */
export function newMessagePortMainRpcSession<T extends object>(
  port: MessagePortMain,
  localMain?: T,
  options?: RpcSessionOptions,
): RpcStub<T> {
  const transport = new MessagePortMainTransport(port);
  const session = new RpcSession<T>(transport, localMain, options);
  return session.getRemoteMain();
}

class MessagePortMainTransport implements RpcTransportWithCustomEncoding {
  readonly encodingLevel = "structuredClonable" as const;

  private receiveResolver:
    | ((message: StructuredCloneMessage) => void)
    | undefined;
  private receiveRejecter: ((err: Error) => void) | undefined;
  private receiveQueue: StructuredCloneMessage[] = [];
  private error: Error | undefined;

  constructor(private port: MessagePortMain) {
    port.start();
    port.on("message", (event) => {
      if (this.error !== undefined) return;
      if (event.data === null) {
        this.receivedError(new Error("Peer closed MessagePort connection."));
        return;
      }
      if (this.receiveResolver !== undefined) {
        this.receiveResolver(event.data);
        this.receiveResolver = undefined;
        this.receiveRejecter = undefined;
        return;
      }
      this.receiveQueue.push(event.data);
    });
    port.on("close", () => {
      this.receivedError(new Error("MessagePort closed."));
    });
  }

  send(message: StructuredCloneMessage): void {
    if (this.error !== undefined) throw this.error;
    // MessagePortMain.postMessage has no targetOrigin (unlike window.postMessage).
    // oxlint-disable-next-line unicorn/require-post-message-target-origin
    this.port.postMessage(message);
  }

  async receive(): Promise<StructuredCloneMessage> {
    const queued = this.receiveQueue.shift();
    if (queued !== undefined) return queued;
    if (this.error !== undefined) throw this.error;
    return new Promise((resolve, reject) => {
      this.receiveResolver = resolve;
      this.receiveRejecter = reject;
    });
  }

  abort(reason: Error): void {
    // Cap'n Web signals peer close with null; Electron may already have closed the port.
    const signaled = errore.try({
      try: () => {
        // MessagePortMain.postMessage has no targetOrigin (unlike window.postMessage).
        // oxlint-disable-next-line unicorn/require-post-message-target-origin, unicorn/no-null
        this.port.postMessage(null);
      },
      catch: (e) =>
        new Error("MessagePortMain close signal failed", { cause: e }),
    });
    if (signaled instanceof Error) {
      console.warn(signaled.message);
    }
    this.port.close();
    if (this.error === undefined) this.error = reason;
  }

  private receivedError(reason: Error): void {
    if (this.error !== undefined) return;
    this.error = reason;
    if (this.receiveRejecter !== undefined) {
      this.receiveRejecter(reason);
      this.receiveResolver = undefined;
      this.receiveRejecter = undefined;
    }
  }
}
