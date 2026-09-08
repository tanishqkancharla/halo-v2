/* oxlint-disable react/iframe-missing-sandbox -- ExtensionHost uses a separate origin; scripts need that origin for API and storage access. */
import { backgroundColor, flex, Padding, Text } from "maui";
import { style, useStyles } from "purse-styles";
import { useExtensionsQuery, useWorkspaceQuery } from "../api/ApiProvider.tsx";
import { PaneHeader } from "./PaneHeader.js";
import {
  ExtensionPermissionRequests,
  ExtensionPermissionsButton,
} from "../ExtensionPermissions.js";

export function ExtensionPane({ extensionId }: { extensionId: string }) {
  const workspace = useWorkspaceQuery().data;
  const extensions = useExtensionsQuery(workspace);
  const extension = extensions.data?.find((entry) => entry.id === extensionId);
  const pane = useStyles(styles.pane);
  const frame = useStyles(styles.frame);

  return (
    <main className={pane} aria-label={extensionId}>
      <PaneHeader
        section="Extensions"
        title={extensionId}
        actions={
          extension === undefined ? undefined : (
            <ExtensionPermissionsButton key={extensionId} id={extensionId} />
          )
        }
      />
      <ExtensionPermissionRequests extensionId={extensionId} />
      {extensions.isPending && (
        <Padding xy={8}>
          <Text role="status">Loading extension…</Text>
        </Padding>
      )}
      {extensions.isError && (
        <Padding xy={8}>
          <Text role="alert">{extensions.error.message}</Text>
        </Padding>
      )}
      {extensions.isSuccess && extension === undefined && (
        <Padding xy={8}>
          <Text>Extension '{extensionId}' is not running.</Text>
        </Padding>
      )}
      {extension !== undefined && (
        <iframe
          key={extension.id}
          className={frame}
          title={extension.id}
          src={extension.url}
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      )}
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
  frame: style({
    flex: "1 1 auto",
    width: "100%",
    minWidth: 0,
    minHeight: 0,
    border: 0,
  }),
};
