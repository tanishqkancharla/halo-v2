import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { src } from "../test/fixtures.js";
import { compilePluginView } from "./compilePluginView.js";
import { evaluatePluginView } from "../../renderer/evaluatePluginView.js";

const compileTest = test.extend<{ pluginDir: string }>({
  pluginDir: async ({ task }, use) => {
    const directory = await mkdtemp(join(tmpdir(), `halo-view-${task.id}-`));
    await use(directory);
    await rm(directory, { recursive: true, force: true });
  },
});

async function compileView(pluginDir: string, contents: string) {
  const viewPath = join(pluginDir, "view.tsx");
  await writeFile(viewPath, contents);
  return compilePluginView({
    id: "notes",
    directory: pluginDir,
    viewPath,
  });
}

function requireSpecifiers(source: string) {
  return [
    ...new Set(
      [...source.matchAll(/require\("([^"]+)"\)/g)].map((match) => match[1]),
    ),
  ];
}

describe("compilePluginView", () => {
  compileTest(
    "inlines extensionless maui/src utils from Halo's maui",
    async ({ pluginDir }) => {
      const compiled = await compileView(
        pluginDir,
        src`
          export { memoize } from "maui/src/utils/memoize"
          export { fuzzyMatch } from "maui/src/utils/fuzzyMatch"
          export { randomId } from "maui/src/utils/randomId"
        `,
      );
      if (compiled instanceof Error) throw compiled;

      expect(compiled.source).toContain("JSON.stringify");
      expect(compiled.source).toContain("toLowerCase");
      expect(compiled.source).toContain("Math.random");
      expect(requireSpecifiers(compiled.source)).toEqual([]);
    },
  );

  compileTest(
    "inlines the published @tanishqkancharla/maui/src path without an extension",
    async ({ pluginDir }) => {
      const compiled = await compileView(
        pluginDir,
        src`
          export { memoize } from "@tanishqkancharla/maui/src/utils/memoize"
        `,
      );
      if (compiled instanceof Error) throw compiled;

      expect(compiled.source).toContain("JSON.stringify");
      expect(requireSpecifiers(compiled.source)).toEqual([]);
    },
  );

  compileTest(
    "treats @tanishqkancharla/maui as Halo's maui barrel",
    async ({ pluginDir }) => {
      const compiled = await compileView(
        pluginDir,
        src`
          export { Flex } from "@tanishqkancharla/maui"
        `,
      );
      if (compiled instanceof Error) throw compiled;

      expect(requireSpecifiers(compiled.source)).toEqual(["maui"]);
    },
  );

  compileTest(
    "treats maui/src as Halo's maui barrel",
    async ({ pluginDir }) => {
      const compiled = await compileView(
        pluginDir,
        src`
          export { Flex } from "maui/src"
        `,
      );
      if (compiled instanceof Error) throw compiled;

      expect(requireSpecifiers(compiled.source)).toEqual(["maui"]);
    },
  );

  compileTest(
    "keeps the maui barrel and plugin-sdk view external",
    async ({ pluginDir }) => {
      const compiled = await compileView(
        pluginDir,
        src`
          export { Flex } from "maui"
          export { H1 } from "@halo/plugin-sdk/view"
        `,
      );
      if (compiled instanceof Error) throw compiled;

      expect(requireSpecifiers(compiled.source).toSorted()).toEqual([
        "@halo/plugin-sdk/view",
        "maui",
      ]);
    },
  );

  compileTest(
    "loads a view that uses a compiled maui util",
    async ({ pluginDir }) => {
      const compiled = await compileView(
        pluginDir,
        src`
          import { memoize } from "@tanishqkancharla/maui/src/utils/memoize"

          const title = memoize(() => "Notes")

          export function Sidebar() {
            return title()
          }
        `,
      );
      if (compiled instanceof Error) throw compiled;

      const loaded = evaluatePluginView(compiled);
      if (loaded instanceof Error) throw loaded;
      expect(loaded.Sidebar).toBeTypeOf("function");
    },
  );

  compileTest(
    "fails when a maui source file does not exist",
    async ({ pluginDir }) => {
      const compiled = await compileView(
        pluginDir,
        src`
          export { missing } from "maui/src/utils/does-not-exist"
        `,
      );
      expect(compiled).toBeInstanceOf(Error);
      if (compiled instanceof Error) {
        expect(compiled.message).toMatch(/Could not resolve/);
      }
    },
  );
});
