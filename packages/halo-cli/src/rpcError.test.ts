import { describe, expect, test } from "vitest";
import { HaloRpcFileError } from "./rpcFile.js";
import { HaloRpcError, wrapRpc } from "./rpcError.js";

describe("HaloRpcError", () => {
  test("uses a file-agnostic message template for RPC call failures", () => {
    const cause = new Error("server.info failed");
    const error = new HaloRpcError({ detail: "server.info failed", cause });

    expect(error.name).toBe("HaloRpcError");
    expect(error.message).toBe("RPC call failed: server.info failed");
    expect(error.messageTemplate).toBe("RPC call failed: $detail");
    expect(error.cause).toBe(cause);
  });

  test("is distinct from HaloRpcFileError and does not blame the file read", () => {
    const rpc = new HaloRpcError({ detail: "server.info failed" });
    const file = new HaloRpcFileError({ detail: "read failed" });

    expect(rpc).not.toBeInstanceOf(HaloRpcFileError);
    expect(file).not.toBeInstanceOf(HaloRpcError);
    expect(HaloRpcError.is(rpc)).toBe(true);
    expect(HaloRpcFileError.is(file)).toBe(true);
    expect(rpc.message.startsWith("Failed to read rpc.json:")).toBe(false);
  });
});

describe("wrapRpc", () => {
  test("wraps an RPC failure in HaloRpcError, not HaloRpcFileError", () => {
    const inner = new Error(
      "Plugin id '1bad' is invalid: must match [a-z][a-z0-9-]*",
    );
    const wrapped = wrapRpc(inner);

    expect(wrapped).toBeInstanceOf(HaloRpcError);
    expect(wrapped).not.toBeInstanceOf(HaloRpcFileError);
    expect(HaloRpcError.is(wrapped)).toBe(true);
    expect(wrapped.name).toBe("HaloRpcError");
    expect(wrapped.message).toBe(
      "RPC call failed: Plugin id '1bad' is invalid: must match [a-z][a-z0-9-]*",
    );
    expect(wrapped.cause).toBe(inner);
  });

  test("does not prefix the message with the false 'Failed to read rpc.json:' header", () => {
    const wrapped = wrapRpc(new Error("server.info failed"));

    expect(wrapped.message.startsWith("Failed to read rpc.json:")).toBe(false);
    expect(wrapped.message.startsWith("RPC call failed:")).toBe(true);
  });

  test("preserves the inner message for server-side plugin failures", () => {
    const wrapped = wrapRpc(new Error("Plugin 'notes' already exists"));

    expect(wrapped.message).toBe(
      "RPC call failed: Plugin 'notes' already exists",
    );
  });
});
