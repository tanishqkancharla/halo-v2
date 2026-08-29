import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parsePluginArgv } from "@halo/cli";
import { describe, expect, test } from "vitest";
import { WorkspaceService } from "../workspace/WorkspaceService.js";
import { PluginIdError } from "./pluginId.js";
import { PluginExistsError, PluginService } from "./PluginService.js";

const pluginServiceTest = test.extend<{
  workspaceRoot: string;
  plugins: PluginService;
}>({
  workspaceRoot: async ({ task }, use) => {
    const directory = await mkdtemp(
      join(tmpdir(), `halo-plugin-ws-${task.id}-`),
    );
    await use(await realpath(directory));
    await rm(directory, { recursive: true, force: true });
  },
  plugins: async ({ workspaceRoot, task }, use) => {
    const userDataDir = await mkdtemp(
      join(tmpdir(), `halo-plugin-ud-${task.id}-`),
    );
    const workspace = new WorkspaceService(userDataDir, {
      appVersion: "1.2.3",
    });
    const selected = await workspace.select(workspaceRoot);
    if (selected instanceof Error) throw selected;
    await use(new PluginService(workspace));
    await rm(userDataDir, { recursive: true, force: true });
  },
});

describe("PluginService", () => {
  pluginServiceTest(
    "create writes a plugin that builds and lists",
    async ({ plugins, workspaceRoot }) => {
      const created = await plugins.create("notes");
      if (created instanceof Error) throw created;

      expect(created.id).toBe("notes");
      expect(created.directory).toBe(
        join(workspaceRoot, ".halo", "plugins", "notes"),
      );

      // SAFETY: scaffold package.json is { halo: { name }, devDependencies }.
      const packageJson = JSON.parse(
        await readFile(join(created.directory, "package.json"), "utf8"),
      ) as {
        halo: { name: string };
        devDependencies: { "@get-halo/plugin-sdk": string };
      };
      expect(packageJson.halo.name).toBe("Notes");
      expect(packageJson.devDependencies["@get-halo/plugin-sdk"]).toBe("1.2.3");

      const built = await plugins.build();
      if (built instanceof Error) throw built;
      expect(built.built).toEqual(["notes"]);
      expect(built.errors).toEqual([]);

      const listed = await plugins.list();
      if (listed instanceof Error) throw listed;
      expect(listed.errors).toEqual([]);
      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["notes"]);
      expect(listed.plugins[0]?.halo.capabilities).toEqual([]);
      expect(listed.compiledViews[0]?.source).toContain("Notes");
    },
  );

  pluginServiceTest(
    "create rejects reserved and duplicate ids",
    async ({ plugins }) => {
      const reserved = await plugins.create("new");
      expect(reserved).toBeInstanceOf(PluginIdError);

      const created = await plugins.create("notes");
      if (created instanceof Error) throw created;
      const duplicate = await plugins.create("notes");
      expect(duplicate).toBeInstanceOf(PluginExistsError);
    },
  );

  pluginServiceTest(
    "list keeps stale dist until build",
    async ({ plugins, workspaceRoot }) => {
      const created = await plugins.create("notes");
      if (created instanceof Error) throw created;
      const built = await plugins.build();
      if (built instanceof Error) throw built;

      await writeFile(
        join(workspaceRoot, ".halo", "plugins", "notes", "view.tsx"),
        `export function Routes() { return "updated-notes-view"; }\n`,
      );

      const stale = await plugins.list();
      if (stale instanceof Error) throw stale;
      expect(stale.compiledViews[0]?.source).toContain("Notes");
      expect(stale.compiledViews[0]?.source).not.toContain(
        "updated-notes-view",
      );

      const rebuilt = await plugins.build();
      if (rebuilt instanceof Error) throw rebuilt;
      const fresh = await plugins.list();
      if (fresh instanceof Error) throw fresh;
      expect(fresh.compiledViews[0]?.source).toContain("updated-notes-view");
    },
  );

  pluginServiceTest(
    "missing dist is an error and does not block others",
    async ({ plugins, workspaceRoot }) => {
      const notes = await plugins.create("notes");
      if (notes instanceof Error) throw notes;
      const extra = await plugins.create("extra");
      if (extra instanceof Error) throw extra;
      const built = await plugins.build();
      if (built instanceof Error) throw built;

      await rm(join(workspaceRoot, ".halo", "plugins", "notes", "dist"), {
        recursive: true,
        force: true,
      });

      const listed = await plugins.list();
      if (listed instanceof Error) throw listed;
      expect(listed.plugins.map((plugin) => plugin.id)).toEqual(["extra"]);
      expect(listed.errors).toEqual([
        {
          id: "notes",
          message:
            "Plugin 'notes' is missing dist/view.js. Run halo plugin build.",
        },
      ]);
    },
  );

  pluginServiceTest(
    "types accepts async iterators and reports a bad view",
    async ({ plugins, workspaceRoot }) => {
      const created = await plugins.create("notes");
      if (created instanceof Error) throw created;

      await writeFile(
        join(created.directory, "server.ts"),
        `import { pluginOs } from "@get-halo/plugin-sdk/server";

export default {
  count: pluginOs.handler(() => (async function* () {
    yield 1;
    yield 2;
  })()),
};
`,
      );

      const clean = await plugins.types();
      if (clean instanceof Error) throw clean;
      expect(clean.written).toEqual(["notes"]);
      expect(clean.diagnostics).toEqual([]);

      await writeFile(
        join(workspaceRoot, ".halo", "plugins", "notes", "view.tsx"),
        `import { Flex } from "@get-halo/plugin-sdk/view";
export function Routes() {
  return <Flex noSuchProp />;
}
`,
      );

      const broken = await plugins.types();
      if (broken instanceof Error) throw broken;
      expect(broken.diagnostics.length).toBeGreaterThan(0);
      expect(broken.diagnostics[0]?.id).toBe("notes");
      expect(broken.diagnostics[0]?.file).toContain("view.tsx");
      expect(broken.diagnostics[0]?.message.length).toBeGreaterThan(0);
    },
  );

  pluginServiceTest(
    "types accepts storage.ts and Maui controls",
    async ({ plugins, workspaceRoot }) => {
      const created = await plugins.create("todos");
      if (created instanceof Error) throw created;
      const directory = join(workspaceRoot, ".halo", "plugins", "todos");

      await writeFile(
        join(directory, "storage.ts"),
        `import { collection, defineSchema, t } from "@get-halo/plugin-sdk/storage";

export const todoTables = defineSchema({
  todos: collection({
    id: t.id(),
    title: t.string(),
    done: t.boolean(),
  }),
});
`,
      );
      await writeFile(
        join(directory, "server.ts"),
        `import { syncRoutes } from "@get-halo/plugin-sdk/server";
import { todoTables } from "./storage.ts";

export default {
  ...syncRoutes(todoTables),
};
`,
      );
      await writeFile(
        join(directory, "view.tsx"),
        `import {
  Button,
  Checkbox,
  Flex,
  H1,
  PluginStorageProvider,
  Route,
  Switch,
  TextField,
  usePluginQuery,
  usePluginTransaction,
  useState,
} from "@get-halo/plugin-sdk/view";
import { todoTables } from "./storage.ts";

type Todo = { id: string; title: string; done: boolean };

export function Routes() {
  return (
    <PluginStorageProvider tables={todoTables}>
      <Switch>
        <Route path="/" component={Home} />
      </Switch>
    </PluginStorageProvider>
  );
}

function Home() {
  const todos = usePluginQuery<Todo>({ collection: "todos" }, []);
  const addTodo = usePluginTransaction((tx, title: string) => {
    tx.set("todos", { id: crypto.randomUUID(), title, done: false });
  });
  const [title, setTitle] = useState("");
  return (
    <Flex column gap={4}>
      <H1>Todos</H1>
      <TextField aria-label="New todo" value={title} onChange={setTitle} />
      <Button onClick={() => addTodo(title)}>Add</Button>
      {todos.map((todo) => (
        <Flex key={todo.id} gap={2}>
          <Checkbox
            label={todo.title}
            checked={todo.done}
            setChecked={() => {
              addTodo(todo.title);
            }}
          />
        </Flex>
      ))}
    </Flex>
  );
}
`,
      );

      const checked = await plugins.types();
      if (checked instanceof Error) throw checked;
      expect(checked.diagnostics).toEqual([]);
    },
  );

  pluginServiceTest(
    "wrong SDK pin is rejected on types, build, and list",
    async ({ plugins, workspaceRoot }) => {
      const created = await plugins.create("notes");
      if (created instanceof Error) throw created;

      const packagePath = join(
        workspaceRoot,
        ".halo",
        "plugins",
        "notes",
        "package.json",
      );
      // SAFETY: scaffold package.json is a JSON object.
      const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as {
        devDependencies: { "@get-halo/plugin-sdk": string };
      };
      packageJson.devDependencies["@get-halo/plugin-sdk"] = "9.9.9";
      await writeFile(
        packagePath,
        `${JSON.stringify(packageJson, undefined, 2)}\n`,
      );

      const checked = await plugins.types();
      if (checked instanceof Error) throw checked;
      expect(checked.written).toEqual([]);
      expect(checked.diagnostics[0]?.file).toBe("package.json");
      expect(checked.diagnostics[0]?.message).toContain("9.9.9");

      const built = await plugins.build();
      if (built instanceof Error) throw built;
      expect(built.built).toEqual([]);
      expect(built.errors[0]?.message).toContain("9.9.9");

      const listed = await plugins.list();
      if (listed instanceof Error) throw listed;
      expect(listed.plugins).toEqual([]);
      expect(listed.errors[0]?.message).toContain("9.9.9");
    },
  );
});

describe("parsePluginArgv", () => {
  test("new is create, not a plugin id", () => {
    const parsed = parsePluginArgv(["new", "notes"], undefined);
    if (parsed instanceof Error) throw parsed;
    expect(parsed).toEqual({ kind: "create", id: "notes" });
  });

  test("types is reserved", () => {
    const parsed = parsePluginArgv(["types"], undefined);
    if (parsed instanceof Error) throw parsed;
    expect(parsed).toEqual({ kind: "types" });
  });

  test("dotted and spaced procedure paths", () => {
    const dotted = parsePluginArgv(["notes", "todos.list"], undefined);
    if (dotted instanceof Error) throw dotted;
    expect(dotted).toEqual({
      kind: "call",
      id: "notes",
      path: ["todos", "list"],
      input: undefined,
    });

    const spaced = parsePluginArgv(["notes", "todos", "list"], '{"n":1}');
    if (spaced instanceof Error) throw spaced;
    expect(spaced).toEqual({
      kind: "call",
      id: "notes",
      path: ["todos", "list"],
      input: { n: 1 },
    });
  });
});
