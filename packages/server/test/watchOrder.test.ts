import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { FilesystemService } from "../src/filesystem/FilesystemService.js";
import { mapFilesystemEventsToTreeEvents } from "../src/workspace/WorkspaceService.js";

/**
 * Real `FilesystemService` whose `stat` amplifies the latency of direct-child
 * stats to ~8 ms each, modeling NFS/SSHFS/encrypted-volume `getattr` round
 * trips. With the local watcher every create event enriches via one `stat`,
 * so a batch with N direct children spends ~N * 8 ms in enrichment, which is
 * long enough for the next dispatched batch to overtake it when batch
 * processing is not serialized. The assertions below confirm that the
 * consumer's `directoryPaths` set stays in sync with disk under that race.
 */
class SlowStatFilesystemService extends FilesystemService {
  constructor(private readonly watchRoot: string) {
    super();
  }

  async stat(filePath: string) {
    const result = await super.stat(filePath);
    if (result instanceof Error) return result;
    const isDirectChild =
      filePath.startsWith(this.watchRoot + path.sep) &&
      filePath.split(path.sep).length ===
        this.watchRoot.split(path.sep).length + 1;
    if (isDirectChild) await new Promise((resolve) => setTimeout(resolve, 8));
    return result;
  }
}

function subscribeDirectoryPaths(
  fsService: FilesystemService,
  watchDir: string,
  directoryPaths: Set<string>,
) {
  fsService.watchEvents.subscribe((batch) => {
    if (batch instanceof Error) return;
    if (batch.watchedPath !== watchDir) return;
    mapFilesystemEventsToTreeEvents(watchDir, batch.events, directoryPaths);
  });
}

function directoryIsListed(directoryPaths: Set<string>, name: string) {
  return [...directoryPaths].some(
    (listed) => listed === `${name}/` || listed.startsWith(`${name}/`),
  );
}

test("watch batches reach the consumer in dispatch order under amplified stat latency", async () => {
  const watchDir = fs.mkdtempSync(path.join(os.tmpdir(), "halo-order-"));
  const fsService = new SlowStatFilesystemService(watchDir);
  const directoryPaths = new Set<string>();

  await fsService.watch(watchDir);
  subscribeDirectoryPaths(fsService, watchDir, directoryPaths);

  for (let i = 0; i < 120; i++)
    fs.writeFileSync(path.join(watchDir, `f${i}`), "x");
  fs.mkdirSync(path.join(watchDir, "D"));
  await new Promise((resolve) => setTimeout(resolve, 110));
  fs.rmSync(path.join(watchDir, "D"), { recursive: true });
  for (let i = 0; i < 5; i++)
    fs.writeFileSync(path.join(watchDir, `g${i}`), "x");

  await new Promise((resolve) => setTimeout(resolve, 4_000));
  await fsService.close();
  fs.rmSync(watchDir, { recursive: true, force: true });

  expect(directoryIsListed(directoryPaths, "D")).toBe(false);
}, 30_000);

test("a recreated directory is not dropped when a later batch overtakes its delete", async () => {
  const watchDir = fs.mkdtempSync(path.join(os.tmpdir(), "halo-missing-"));
  const fsService = new SlowStatFilesystemService(watchDir);
  const directoryPaths = new Set<string>();

  await fsService.watch(watchDir);
  subscribeDirectoryPaths(fsService, watchDir, directoryPaths);

  fs.mkdirSync(path.join(watchDir, "D"));
  await new Promise((resolve) => setTimeout(resolve, 110));
  fs.rmSync(path.join(watchDir, "D"), { recursive: true });
  for (let i = 0; i < 119; i++)
    fs.writeFileSync(path.join(watchDir, `f${i}`), "x");
  await new Promise((resolve) => setTimeout(resolve, 110));
  fs.mkdirSync(path.join(watchDir, "D"));
  for (let i = 0; i < 5; i++)
    fs.writeFileSync(path.join(watchDir, `g${i}`), "x");

  await new Promise((resolve) => setTimeout(resolve, 4_000));
  await fsService.close();
  fs.rmSync(watchDir, { recursive: true, force: true });

  expect(directoryIsListed(directoryPaths, "D")).toBe(true);
}, 30_000);
