import { createServer, type AddressInfo } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { connectHalo } from "./connectHalo.js";
import { HaloRpcFileError } from "./rpcFile.js";
import { HaloRpcError } from "./rpcError.js";

describe("connectHalo", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "halo-connect-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("reports an RPC failure, not a file-read failure, when the server is not running", async () => {
    const port = await freePort();
    const rpcFile = join(dir, "rpc.json");
    await writeFile(
      rpcFile,
      `${JSON.stringify({ version: 1, host: "127.0.0.1", port, token: "t" })}\n`,
    );

    const result = await connectHalo({ HALO_RPC_FILE: rpcFile });

    expect(result).toBeInstanceOf(HaloRpcError);
    expect(result).not.toBeInstanceOf(HaloRpcFileError);
    if (!(result instanceof HaloRpcError))
      throw new Error("expected HaloRpcError");
    expect(result.message).toBe("RPC call failed: server.info failed");
    expect(result.cause).toBeInstanceOf(Error);
  });

  test("still reports a file-read failure when rpc.json is missing", async () => {
    const result = await connectHalo({ HALO_RPC_FILE: join(dir, "nope.json") });

    expect(result).toBeInstanceOf(HaloRpcFileError);
    expect(result).not.toBeInstanceOf(HaloRpcError);
    if (!(result instanceof HaloRpcFileError))
      throw new Error("expected HaloRpcFileError");
    expect(result.message).toBe("Failed to read rpc.json: read failed");
  });

  test("still reports a file-read failure when rpc.json is invalid JSON", async () => {
    const rpcFile = join(dir, "rpc.json");
    await writeFile(rpcFile, "{not json");
    const result = await connectHalo({ HALO_RPC_FILE: rpcFile });

    expect(result).toBeInstanceOf(HaloRpcFileError);
    expect(result).not.toBeInstanceOf(HaloRpcError);
    if (!(result instanceof HaloRpcFileError))
      throw new Error("expected HaloRpcFileError");
    expect(result.message).toBe("Failed to read rpc.json: invalid JSON");
  });
});

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      // SAFETY: listening on a TCP host guarantees address is an AddressInfo; unix-socket strings and null are unreachable here.
      const address = server.address() as AddressInfo;
      server.close(() => resolve(address.port));
    });
  });
}
