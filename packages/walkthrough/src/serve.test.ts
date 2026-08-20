import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import * as errore from "errore";
import { startWalkthroughServer } from "./serve.js";

const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const sampleMdx = path.join(packageRoot, "fixtures", "sample.mdx");
const sampleSpec = path.join(packageRoot, "fixtures", "sample-spec.md");

describe("walkthrough server", () => {
  test("serves the page, file excerpts, and shutdown", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const server = await startWalkthroughServer({
      mdxPath: sampleMdx,
      workspaceRoot: packageRoot,
      port: 0,
    });
    expect(server).not.toBeInstanceOf(Error);
    if (server instanceof Error) return;
    cleanup.defer(() => server.shutdown());

    const page = await fetch(server.url);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("root");

    const metaResponse = await fetch(`${server.url}/__walkthrough/meta`);
    expect(metaResponse.status).toBe(200);
    // SAFETY: the meta route returns WalkthroughMeta JSON.
    const meta = (await metaResponse.json()) as {
      title: string;
    };
    expect(meta.title).toBe("Walkthrough fixture");

    const excerptResponse = await fetch(
      `${server.url}/__walkthrough/file?path=src/parseFence.ts&start=1&end=4`,
    );
    expect(excerptResponse.status).toBe(200);
    // SAFETY: the file route returns FileExcerpt JSON.
    const excerpt = (await excerptResponse.json()) as { contents: string };
    expect(excerpt.contents).toContain("export type Fence");

    const shutdown = await fetch(`${server.url}/__walkthrough/shutdown`, {
      method: "POST",
    });
    expect(shutdown.status).toBe(200);
  }, 60_000);

  test("serves a spec-shaped markdown file", async () => {
    await using cleanup = new errore.AsyncDisposableStack();
    const server = await startWalkthroughServer({
      mdxPath: sampleSpec,
      workspaceRoot: packageRoot,
      port: 0,
    });
    expect(server).not.toBeInstanceOf(Error);
    if (server instanceof Error) return;
    cleanup.defer(() => server.shutdown());

    const page = await fetch(server.url);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("<title>Spec fixture</title>");

    const metaResponse = await fetch(`${server.url}/__walkthrough/meta`);
    expect(metaResponse.status).toBe(200);
    // SAFETY: the meta route returns WalkthroughMeta JSON.
    const meta = (await metaResponse.json()) as { title: string };
    expect(meta.title).toBe("Spec fixture");
  }, 60_000);
});
