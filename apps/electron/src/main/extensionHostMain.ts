import { RPCHandler } from "@orpc/server/message-port";
import type { MessagePortMain } from "electron";
import { createExtensionHostRouter } from "./plugins/extensionHostRouter.js";

const handler = new RPCHandler(createExtensionHostRouter());

process.parentPort.on("message", (event) => {
  const port: MessagePortMain = event.ports[0]!;
  handler.upgrade(port);
  port.start();
});
