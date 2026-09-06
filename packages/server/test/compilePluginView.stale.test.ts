import path from "node:path";
import outdent from "outdent";
import { expect } from "vitest";
import { serverTest } from "./serverTest.js";

// Regression test for the stale `dist/view.js` bug: `compilePluginView` wrote
// `dist/view.js` on a successful build but left the previous artifact in place
// when a rebuild failed, so `plugins.list` (the renderer's sole path, via
// `PluginService.load()` → `readPluginViewDist`) re-served the stale view with
// no error. The fix removes the stale `outfile` on a failed compile so `list`
// surfaces a missing-dist error instead of a stale view.

serverTest(
  "list surfaces an error and omits the stale view after a failed rebuild",
  async ({ server }) => {
    const plugin = await server.rpc.plugins.create({ id: "staleview" });

    // Initial build succeeds and writes dist/view.js.
    expect(await server.rpc.plugins.build()).toEqual({
      built: ["staleview"],
      errors: [],
    });

    // `list` serves the freshly compiled view with no error.
    const firstList = await server.rpc.plugins.list();
    expect(firstList.errors).toEqual([]);
    const firstView = firstList.compiledViews.find(
      (view) => view.id === "staleview",
    );
    expect(firstView, "freshly built view should be served").toBeDefined();
    // SAFETY: asserted above.
    const freshSource = firstView!.source;
    expect(freshSource.length).toBeGreaterThan(0);

    // Break the view source so the next build fails to compile. Use an
    // unterminated string literal (a single quote avoids clashing with the
    // template literal that holds this fixture content).
    await server.harness.files.write({
      path: path.join(plugin.directory, "view.tsx"),
      content: outdent`
        // unterminated string literal — esbuild rejects this build
        const broken = '
      `,
    });

    // The build path still surfaces the compile error (this is what the CLI
    // prints); the view is not added to `built`.
    const rebuild = await server.rpc.plugins.build();
    expect(rebuild.built).toEqual([]);
    expect(rebuild.errors).toEqual([
      expect.objectContaining({
        id: "staleview",
        message: expect.stringMatching(/failed to compile/i),
      }),
    ]);

    // The renderer's path (`list` → `load()` → `readPluginViewDist`) must NOT
    // serve the stale `dist/view.js`. After the fix the stale artifact is gone,
    // so `list` reports a missing-dist error and omits the compiled view.
    const afterFailure = await server.rpc.plugins.list();
    expect(afterFailure.errors).toContainEqual(
      expect.objectContaining({
        id: "staleview",
        message: expect.stringMatching(/missing .*dist\/view\.js/i),
      }),
    );
    expect(
      afterFailure.compiledViews.find((view) => view.id === "staleview"),
      "stale view must not be served after a failed rebuild",
    ).toBeUndefined();
    // Belt-and-suspenders: the exact stale source compiled before the failure
    // is not present in any served compiled view.
    expect(afterFailure.compiledViews.map((view) => view.source)).not.toContain(
      freshSource,
    );

    // Recovery: fixing the source and rebuilding serves a fresh view again.
    // The marker is exported (not just declared) so esbuild retains it in the
    // bundle, giving the served source an identifiable, build-specific token.
    await server.harness.files.write({
      path: path.join(plugin.directory, "view.tsx"),
      content: outdent`
        export function Sidebar() {
          return null;
        }
        export function Routes() {
          return null;
        }
        export const MARKER = "recovered";
      `,
    });
    expect(await server.rpc.plugins.build()).toEqual({
      built: ["staleview"],
      errors: [],
    });
    const recovered = await server.rpc.plugins.list();
    expect(recovered.errors).toEqual([]);
    const recoveredView = recovered.compiledViews.find(
      (view) => view.id === "staleview",
    );
    expect(recoveredView, "fresh view served after recovery").toBeDefined();
    // SAFETY: asserted above.
    expect(recoveredView!.source).not.toBe(freshSource);
    expect(recoveredView!.source).toContain("recovered");
  },
  30_000,
);

serverTest(
  "list serves a fresh view after a successful rebuild",
  async ({ server }) => {
    const plugin = await server.rpc.plugins.create({ id: "freshview" });

    await server.harness.files.write({
      path: path.join(plugin.directory, "view.tsx"),
      content: outdent`
        export function Sidebar() {
          return null;
        }
        export function Routes() {
          return null;
        }
        export const MARKER = "alpha";
      `,
    });
    expect(await server.rpc.plugins.build()).toEqual({
      built: ["freshview"],
      errors: [],
    });
    const source1 = (await server.rpc.plugins.list()).compiledViews.find(
      (view) => view.id === "freshview",
    )!.source;
    expect(source1).toContain("alpha");

    // Rewrite the view with different content and rebuild successfully.
    await server.harness.files.write({
      path: path.join(plugin.directory, "view.tsx"),
      content: outdent`
        export function Sidebar() {
          return null;
        }
        export function Routes() {
          return null;
        }
        export const MARKER = "beta";
      `,
    });
    expect(await server.rpc.plugins.build()).toEqual({
      built: ["freshview"],
      errors: [],
    });
    const source2 = (await server.rpc.plugins.list()).compiledViews.find(
      (view) => view.id === "freshview",
    )!.source;
    expect(source2).toContain("beta");
    // The server's `load()` reflects a successful rebuild immediately; the
    // served source must differ from the pre-rebuild source.
    expect(source2).not.toBe(source1);
  },
  30_000,
);

serverTest(
  "list reports missing dist and no view when the very first build fails",
  async ({ server }) => {
    const plugin = await server.rpc.plugins.create({ id: "firstfail" });

    // Overwrite view.tsx with invalid syntax BEFORE any successful build, so
    // there is no prior dist/view.js. This exercises the ENOENT-safe branch of
    // the fix: unlinking a non-existent outfile must not crash or surface a
    // spurious error.
    await server.harness.files.write({
      path: path.join(plugin.directory, "view.tsx"),
      content: outdent`
        // unterminated string literal — esbuild rejects this build
        const broken = '
      `,
    });

    const build = await server.rpc.plugins.build();
    expect(build.built).toEqual([]);
    expect(build.errors).toEqual([
      expect.objectContaining({
        id: "firstfail",
        message: expect.stringMatching(/failed to compile/i),
      }),
    ]);

    // list must report a missing-dist error (not a stale/empty result) and no
    // compiled view.
    const listed = await server.rpc.plugins.list();
    expect(listed.errors).toContainEqual(
      expect.objectContaining({
        id: "firstfail",
        message: expect.stringMatching(/missing .*dist\/view\.js/i),
      }),
    );
    expect(
      listed.compiledViews.find((view) => view.id === "firstfail"),
    ).toBeUndefined();
  },
  30_000,
);
