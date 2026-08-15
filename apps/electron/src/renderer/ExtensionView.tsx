import { P, backgroundColor, flex, spacing } from "maui";
import { style, useStyles } from "purse-styles";
import type { LoadedExtension } from "../shared/evaluateExtensionSource.ts";

export function ExtensionView({
  extension,
  viewId,
}: {
  extension: LoadedExtension;
  viewId: string;
}) {
  const View = extension.views[viewId];
  if (View === undefined) {
    return <MissingView extensionId={extension.id} viewId={viewId} />;
  }
  return <View />;
}

function MissingView({
  extensionId,
  viewId,
}: {
  extensionId: string;
  viewId: string;
}) {
  const pane = useStyles(styles.pane);
  return (
    <main className={pane} aria-label="Missing view">
      <P>
        Extension {extensionId} has no view named {viewId}.
      </P>
    </main>
  );
}

const styles = {
  pane: style(
    flex({ direction: "column" }),
    spacing.padding({ x: 12, y: 12 }),
    {
      width: "100%",
      minWidth: 0,
      minHeight: 0,
      overflow: "hidden",
      backgroundColor: backgroundColor.app,
    },
  ),
};
