import { expect, test } from "vitest";
import { Stream } from "./Stream.js";

test("consume accepts optional options and stops when aborted", async () => {
  const stream = new Stream<number>();
  const abortController = new AbortController();
  const values = stream
    .map((value) => value * 2)
    .filter((value) => value > 2)
    .consume({ abortSignal: abortController.signal });

  const first = values.next();
  stream.append(1);
  stream.append(2);
  await expect(first).resolves.toEqual({ done: false, value: 4 });

  const finished = values.next();
  abortController.abort();
  await expect(finished).resolves.toEqual({ done: true, value: undefined });

  stream.append(3);
  await expect(values.next()).resolves.toEqual({
    done: true,
    value: undefined,
  });
});

test("consume works without options", async () => {
  const stream = new Stream<string>();
  const values = stream.consume();
  const first = values.next();
  stream.append("ready");

  await expect(first).resolves.toEqual({ done: false, value: "ready" });
  await values.return();
});
