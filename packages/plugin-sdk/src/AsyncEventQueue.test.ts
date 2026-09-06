import { describe, expect, test } from "vitest";
import { AsyncEventQueue } from "@halo/plugin-sdk/shared";

async function state(
  p: Promise<unknown>,
  ms = 50,
): Promise<"resolved" | "rejected" | "pending"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([
    p.then(
      () => "resolved" as const,
      () => "rejected" as const,
    ),
    new Promise<"pending">((resolve) => {
      timer = setTimeout(() => resolve("pending"), ms);
    }),
  ]);
  if (timer !== undefined) clearTimeout(timer);
  return result;
}

describe("AsyncEventQueue", () => {
  test("delivers pushed values in order and resolves each push() promise", async () => {
    const q = new AsyncEventQueue<number>();
    const p1 = q.push(1);
    const p2 = q.push(2);
    const iter = q.values(undefined);
    expect(await iter.next()).toEqual({ value: 1, done: false });
    expect(await iter.next()).toEqual({ value: 2, done: false });
    q.close();
    expect(await iter.next()).toEqual({ value: undefined, done: true });
    expect(await state(p1)).toBe("resolved");
    expect(await state(p2)).toBe("resolved");
  });

  test("resolves the in-flight push() promise when iteration terminates at yield", async () => {
    const q = new AsyncEventQueue<number>();
    const p = q.push(1);
    const iter = q.values(undefined);
    expect(await iter.next()).toEqual({ value: 1, done: false });
    await iter.return(undefined);
    expect(await state(p)).toBe("resolved");
  });

  test("resolves the in-flight push() promise and propagates the error when thrown into the iterator at yield", async () => {
    const q = new AsyncEventQueue<number>();
    const p = q.push(1);
    const iter = q.values(undefined);
    expect(await iter.next()).toEqual({ value: 1, done: false });
    await expect(iter.throw(new Error("boom"))).rejects.toThrow("boom");
    expect(await state(p)).toBe("resolved");
  });

  test("close() resolves all buffered pending push() promises", async () => {
    const q = new AsyncEventQueue<number>();
    const p1 = q.push(1);
    const p2 = q.push(2);
    q.close();
    expect(await state(p1)).toBe("resolved");
    expect(await state(p2)).toBe("resolved");
  });

  test("aborting while parked in take() ends the iteration without delivering", async () => {
    const q = new AsyncEventQueue<number>();
    const controller = new AbortController();
    const iter = q.values(controller.signal);
    const firstPull = iter.next();
    controller.abort();
    expect(await firstPull).toEqual({ value: undefined, done: true });
    expect(await state(q.push(1))).toBe("resolved");
  });
});
