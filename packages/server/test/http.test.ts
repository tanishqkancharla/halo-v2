import net from "node:net";
import { expect } from "vitest";
import { serverTest } from "./serverTest.js";

serverTest(
  "responds 400 to a malformed absolute-form request-target",
  async ({ server }) => {
    const response = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const socket = net.createConnection(
        { host: server.host, port: server.port },
        () => {
          socket.write(
            "GET http://localhost:99999/ HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n",
          );
        },
      );
      socket.on("data", (chunk: Buffer) => chunks.push(chunk));
      socket.on("end", () => resolve(Buffer.concat(chunks)));
      socket.on("error", reject);
      setTimeout(
        () => socket.destroy(new Error("response timed out (socket hung)")),
        5000,
      ).unref();
    });
    const text = response.toString("latin1");
    expect(text.startsWith("HTTP/1.1 400 Bad Request\r\n")).toBe(true);
    expect(text.endsWith("\r\n\r\nBad request.")).toBe(true);
  },
  15_000,
);
