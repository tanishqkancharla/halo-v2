import {
  PluginServerProvider,
  useSidebarNavigation,
} from "@halo/plugin-sdk/view";
import type { AnyRouter, RouterClient } from "@orpc/server";
import { backgroundColor, flex, spacing } from "maui";
import { style, useStyles } from "purse-styles";
import type { LoadedPluginView } from "../../shared/plugin.js";
import { PaneHeader } from "./PaneHeader.tsx";

export function PluginPane({
  plugin,
  server,
}: {
  plugin: LoadedPluginView;
  server: RouterClient<AnyRouter> | undefined;
}) {
  const pane = useStyles(styles.pane);
  const body = useStyles(styles.pluginBody);
  const navigation = useSidebarNavigation();
  const Routes = plugin.Routes;
  if (Routes === undefined) return <MissingPluginPane pluginId={plugin.id} />;

  return (
    <main className={pane} aria-label={plugin.id}>
      <PaneHeader section={navigation?.section} title={navigation?.page} />
      <div className={body}>
        <PluginServerProvider pluginId={plugin.id} server={server}>
          <Routes />
        </PluginServerProvider>
      </div>
    </main>
  );
}

export function MissingPluginPane({ pluginId }: { pluginId: string }) {
  const pane = useStyles(styles.pane);
  const body = useStyles(styles.missingBody);
  const column = useStyles(styles.column);

  return (
    <main className={pane} aria-label={pluginId}>
      <div className={body}>
        <div className={column}>Plugin '{pluginId}' has no Routes</div>
      </div>
    </main>
  );
}

const styles = {
  pane: style(flex({ direction: "column" }), {
    width: "100%",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: backgroundColor.app,
  }),
  pluginBody: style({
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    overflow: "auto",
  }),
  missingBody: style(
    flex({ direction: "column" }),
    spacing.padding({ x: 12, y: 12 }),
    {
      flex: "1 1 auto",
      width: "100%",
      minWidth: 0,
      minHeight: 0,
    },
  ),
  column: style(flex({ direction: "column" }), {
    flex: "1 1 auto",
    width: "100%",
    maxWidth: "72ch",
    minWidth: 0,
    minHeight: 0,
    marginInline: "auto",
  }),
};
