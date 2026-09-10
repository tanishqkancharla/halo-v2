import { expect, test } from "vitest";
import { Stream } from "@get-halo/shared/Stream";

test("consume accepts optional options and stops when aborted", async () => {
  const stream = new Stream<number>();
  const abortController = new AbortController();
  using values = stream
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

test("consume buffers immediately and delivers buffered and pending reads in order", async () => {
  const stream = new Stream<string | undefined>();
  stream.append("before subscribing");
  using values = stream.consume();
  stream.append("ready");
  stream.append(undefined);

  await expect(values.next()).resolves.toEqual({ done: false, value: "ready" });
  await expect(values.next()).resolves.toEqual({
    done: false,
    value: undefined,
  });

  const reads = [values.next(), values.next()];
  stream.append("first");
  stream.append("second");
  await expect(Promise.all(reads)).resolves.toEqual([
    { done: false, value: "first" },
    { done: false, value: "second" },
  ]);
});

test("projects independent subscriptions and composes with other stream operators", async () => {
  const source = new Stream<number>();
  const totals = source.project<number[]>([], (values, value) => [
    ...values,
    value,
  ]);
  const first: number[][] = [];
  const stopFirst = totals.subscribe((value) => first.push(value));
  source.append(1);
  const second: number[] = [];
  const stopSecond = totals
    .map((values) => values.reduce((sum, value) => sum + value, 0))
    .filter((sum) => sum > 1)
    .subscribe((value) => second.push(value));

  source.append(2);
  source.append(3);
  stopFirst();
  source.append(4);
  stopSecond();

  expect(first).toEqual([[1], [1, 2], [1, 2, 3]]);
  expect(second).toEqual([2, 5, 9]);
});

test("consumes projected states until the consumer is aborted", async () => {
  const source = new Stream<number>();
  const totals = source.project(0, (sum, value) => sum + value);
  const controller = new AbortController();
  using values = totals.consume({ abortSignal: controller.signal });
  source.append(3);
  const first = values.next();
  await expect(first).resolves.toEqual({ done: false, value: 3 });
  const second = values.next();
  source.append(4);
  await expect(second).resolves.toEqual({ done: false, value: 7 });
  const finished = values.next();
  controller.abort();
  await expect(finished).resolves.toEqual({ done: true, value: undefined });
  source.append(5);
  await expect(values.next()).resolves.toEqual({
    done: true,
    value: undefined,
  });
});

test.each(["return", "dispose", "asyncDispose", "abort"] as const)(
  "%s discards buffered values and finishes every pending read",
  async (action) => {
    const stream = new Stream<string>();
    const controller = new AbortController();
    using buffered = stream.consume({ abortSignal: controller.signal });
    stream.append("unread");
    using waiting = stream.consume({ abortSignal: controller.signal });
    const reads = [waiting.next(), waiting.next()];

    if (action === "return") {
      await buffered.return();
      await waiting.return();
    }
    if (action === "dispose") {
      buffered[Symbol.dispose]();
      waiting[Symbol.dispose]();
    }
    if (action === "asyncDispose") {
      await buffered[Symbol.asyncDispose]();
      await waiting[Symbol.asyncDispose]();
    }
    if (action === "abort") controller.abort();

    await expect(Promise.all(reads)).resolves.toEqual([
      { done: true, value: undefined },
      { done: true, value: undefined },
    ]);
    stream.append("after closing");
    await expect(buffered.next()).resolves.toEqual({
      done: true,
      value: undefined,
    });
    await expect(waiting.next()).resolves.toEqual({
      done: true,
      value: undefined,
    });
  },
);

test("breaking iteration closes that consumer while another keeps receiving", async () => {
  const stream = new Stream<number>();
  using first = stream.consume();
  using second = stream.consume();
  stream.append(1);
  for await (const value of first) {
    expect(value).toBe(1);
    break;
  }
  stream.append(2);

  await expect(first.next()).resolves.toEqual({ done: true, value: undefined });
  await expect(second.next()).resolves.toEqual({ done: false, value: 1 });
  await expect(second.next()).resolves.toEqual({ done: false, value: 2 });
});

test("an already-aborted consumer is closed before its first read", async () => {
  const stream = new Stream<number>();
  using values = stream.consume({ abortSignal: AbortSignal.abort() });
  stream.append(1);
  await expect(values.next()).resolves.toEqual({
    done: true,
    value: undefined,
  });
});
