import { PatchDiff } from "@pierre/diffs/react";
import { useTheme } from "maui";
import { radius, shadow } from "maui";
import { style, useStyles } from "purse-styles";
import { toUnifiedDiff } from "../normalizeDiff.js";
import { diffsTheme } from "./diffsTheme.ts";

export function CodeDiff(props: { source: string; path?: string }) {
  const { resolvedTheme } = useTheme();
  const shell = useStyles(styles.shell);
  const path = props.path === undefined ? "change.ts" : props.path;
  const patch = toUnifiedDiff(props.source, path);

  return (
    <div className={shell} data-file-path={path} data-walkthrough-kind="diff">
      <PatchDiff
        patch={patch}
        disableWorkerPool
        options={{
          theme: diffsTheme,
          themeType: resolvedTheme,
          diffStyle: "unified",
          overflow: "wrap",
        }}
      />
    </div>
  );
}

const styles = {
  shell: style(radius.md, shadow.subtle, {
    overflow: "hidden",
    minWidth: 0,
  }),
};
