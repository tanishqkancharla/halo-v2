import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import { type RouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/message-port";
import { describe, expect, test } from "vitest";
import {
  createExtensionHostRouter,
  type ExtensionHostRouter,
} from "./extensionHostRouter.js";

type HostClient = RouterClient<ExtensionHostRouter>;

describe("createExtensionHostRouter", () => {
  test("answers ping over a MessagePort", async () => {
    const { port1, port2 } = new MessageChannel();
    new RPCHandler(createExtensionHostRouter()).upgrade(port1);
    const link = new RPCLink({ port: port2 });
    const client: HostClient = createORPCClient(link);
    port1.start();
    port2.start();
    expect(await client.ping()).toEqual({ ok: true });
    port1.close();
    port2.close();
  });
});
