import { join } from "node:path";
import * as errore from "errore";
import {
  contractPeerDependencies,
  mauiPackage,
} from "@get-halo/plugin-sdk/contract";
import { writePluginTsconfig } from "./typecheckPlugin.js";
import type { FilesystemService } from "../filesystem/FilesystemService.js";

export class PluginScaffoldError extends errore.createTaggedError({
  name: "PluginScaffoldError",
  message: "Failed to scaffold plugin '$id'",
}) {}

export async function writePluginScaffold(args: {
  filesystem: FilesystemService;
  directory: string;
  id: string;
  appVersion: string;
  storage: boolean;
  installDependencies: (directory: string) => Promise<Error | void>;
}) {
  const created = await args.filesystem.makeDirectory(args.directory, {
    recursive: true,
  });
  if (created instanceof Error) {
    return new PluginScaffoldError({ id: args.id, cause: created });
  }

  const files: Array<[string, string]> = [
    ["package.json", packageJsonSource(args.id, args.appVersion)],
    [".gitignore", "node_modules\ndist\n"],
    [
      "view.tsx",
      args.storage ? storageViewSource(args.id) : viewSource(args.id),
    ],
    ["server.ts", args.storage ? storageServerSource() : serverSource()],
  ];
  if (args.storage) files.push(["storage.ts", storageSource()]);
  for (const [name, contents] of files) {
    const written = await args.filesystem.writeFile(
      join(args.directory, name),
      contents,
    );
    if (written instanceof Error) {
      return new PluginScaffoldError({ id: args.id, cause: written });
    }
  }

  const installed = await args.installDependencies(args.directory);
  if (installed instanceof Error) return installed;

  return await writePluginTsconfig({
    filesystem: args.filesystem,
    directory: args.directory,
  });
}

function pluginDisplayName(id: string) {
  const first = id[0];
  if (first === undefined) return id;
  return `${first.toUpperCase()}${id.slice(1)}`;
}

function packageJsonSource(id: string, appVersion: string) {
  return `${JSON.stringify(
    {
      name: `halo-plugin-${id}`,
      halo: {
        version: 1,
        name: pluginDisplayName(id),
        view: "./view.tsx",
        server: "./server.ts",
      },
      devDependencies: {
        "@get-halo/plugin-sdk": appVersion,
        "@types/react": "19.2.2",
        ...contractPeerDependencies,
        maui: mauiPackage,
      },
    },
    undefined,
    2,
  )}\n`;
}

function viewSource(id: string) {
  const name = pluginDisplayName(id);
  return `import { Flex, H1, Padding, proseMaxWidth } from "maui";
import { Route, Switch } from "wouter";
import {
  SidebarItem,
  SidebarSection,
} from "@get-halo/plugin-sdk/view";

export function Sidebar() {
  return (
    <SidebarSection label="${name}">
      <SidebarItem href="/" pageTitle="Home">Home</SidebarItem>
    </SidebarSection>
  );
}

export function Routes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
    </Switch>
  );
}

function Home() {
  return (
    <Padding xy={6}>
      <Flex
        column
        gap={4}
        style={{ width: "100%", maxWidth: proseMaxWidth, marginInline: "auto" }}
      >
        <H1>${name}</H1>
      </Flex>
    </Padding>
  );
}
`;
}

function serverSource() {
  return `import { pluginOs } from "@get-halo/plugin-sdk/server";

const plugin = pluginOs;

export default {
  ping: plugin.handler(async ({ context }) => ({
    pluginId: context.pluginId,
  })),
};
`;
}

function storageSource() {
  return `import { collection, defineSchema, t } from "@get-halo/plugin-sdk/storage";

export const tables = defineSchema({
  items: collection({
    id: t.id(),
    label: t.string(),
    done: t.boolean(),
  }),
});
`;
}

function storageServerSource() {
  return `import { syncRoutes } from "@get-halo/plugin-sdk/server";
import { tables } from "./storage.js";

export default {
  ...syncRoutes(tables),
};
`;
}

function storageViewSource(id: string) {
  const name = pluginDisplayName(id);
  return `import { useState } from "react";
import { Button, Checkbox, Flex, H1, Padding, Text, TextField, proseMaxWidth } from "maui";
import { Route, Switch } from "wouter";
import {
  PluginStorageProvider,
  SidebarItem,
  SidebarSection,
  usePluginQuery,
  usePluginTransaction,
} from "@get-halo/plugin-sdk/view";
import { tables } from "./storage.js";

type Item = { id: string; label: string; done: boolean };

export function Sidebar() {
  return (
    <SidebarSection label="${name}">
      <SidebarItem href="/" pageTitle="Home">Home</SidebarItem>
    </SidebarSection>
  );
}

export function Routes() {
  return (
    <PluginStorageProvider tables={tables}>
      <Switch>
        <Route path="/" component={Home} />
      </Switch>
    </PluginStorageProvider>
  );
}

function Home() {
  const [label, setLabel] = useState("");
  const items = usePluginQuery<Item>({ collection: "items" }, []);
  const addItem = usePluginTransaction((tx, nextLabel: string) => {
    tx.set("items", { id: crypto.randomUUID(), label: nextLabel, done: false });
  });
  const setDone = usePluginTransaction((tx, item: Item, done: boolean) => {
    tx.set("items", { ...item, done });
  });

  return (
    <Padding xy={6}>
      <Flex
        column
        gap={4}
        style={{ width: "100%", maxWidth: proseMaxWidth, marginInline: "auto" }}
      >
        <H1>${name}</H1>
        <Flex row gap={2}>
          <TextField aria-label="New item" value={label} onChange={setLabel} />
          <Button
            onClick={() => {
              addItem(label);
              setLabel("");
            }}
          >
            Add
          </Button>
        </Flex>
        {items.length === 0 ? (
          <Text color="lowContrast">No items yet.</Text>
        ) : (
          items.map((item) => (
            <Checkbox
              key={item.id}
              label={item.label}
              checked={item.done}
              setChecked={(done) => setDone(item, done)}
            />
          ))
        )}
      </Flex>
    </Padding>
  );
}
`;
}
