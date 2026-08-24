import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as errore from "errore";
import { installPluginSdkContract } from "./installPluginSdk.js";
import { writePluginTsconfig } from "./typecheckPlugin.js";

export class PluginScaffoldError extends errore.createTaggedError({
  name: "PluginScaffoldError",
  message: "Failed to scaffold plugin '$id'",
}) {}

export async function writePluginScaffold(args: {
  directory: string;
  id: string;
  appVersion: string;
}) {
  const created = await mkdir(args.directory, { recursive: true }).catch(
    (e) => new PluginScaffoldError({ id: args.id, cause: e }),
  );
  if (created instanceof Error) return created;

  const files: Array<[string, string]> = [
    ["package.json", packageJsonSource(args.id, args.appVersion)],
    [".gitignore", "node_modules\ndist\n"],
    ["view.tsx", viewSource(args.id)],
    ["server.ts", serverSource()],
  ];
  for (const [name, contents] of files) {
    const written = await writeFile(join(args.directory, name), contents).catch(
      (e) => new PluginScaffoldError({ id: args.id, cause: e }),
    );
    if (written instanceof Error) return written;
  }

  const installed = await installPluginSdkContract({
    directory: args.directory,
    appVersion: args.appVersion,
  });
  if (installed instanceof Error) return installed;

  return writePluginTsconfig(args.directory);
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
      },
    },
    undefined,
    2,
  )}\n`;
}

function viewSource(id: string) {
  const name = pluginDisplayName(id);
  return `import {
  Flex,
  H1,
  Route,
  SidebarItem,
  SidebarSection,
  Switch,
} from "@get-halo/plugin-sdk/view";

export function Sidebar() {
  return (
    <SidebarSection label="${name}">
      <SidebarItem href="/">Home</SidebarItem>
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
    <Flex column gap={4}>
      <H1>${name}</H1>
    </Flex>
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
