import type { SupportedMessagePort } from "@orpc/client/message-port";
import { RPCHandler } from "@orpc/server/message-port";
import type { MessagePortMain } from "electron";
import {
  type MessagePort as ThreadMessagePort,
  parentPort as threadParentPort,
} from "node:worker_threads";
import { createExtensionHostRouter } from "./plugins/extensionHostRouter.js";

const handler = new RPCHandler(createExtensionHostRouter());

function serve(port: SupportedMessagePort & { start: () => void }) {
  handler.upgrade(port);
  port.start();
}

if (threadParentPort !== null) {
  threadParentPort.on("message", (message: { port: ThreadMessagePort }) => {
    serve(message.port);
  });
} else {
  process.parentPort.on("message", (event) => {
    const port: MessagePortMain = event.ports[0]!;
    serve(port);
  });
}
