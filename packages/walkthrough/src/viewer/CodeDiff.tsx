import { PatchDiff } from "@pierre/diffs/react";
import { useTheme } from "maui";
import { useStyles } from "purse-styles";
import { toUnifiedDiff } from "../normalizeDiff.js";
import { pierreDiffOptions, pierreShell } from "./pierre.ts";

export function CodeDiff(props: { source: string; path?: string }) {
  const { resolvedTheme } = useTheme();
  const shell = useStyles(pierreShell);
  const path = props.path === undefined ? "change.ts" : props.path;
  const patch = toUnifiedDiff(props.source, path);

  return (
    <div className={shell} data-file-path={path} data-walkthrough-kind="diff">
      <PatchDiff
        patch={patch}
        disableWorkerPool
        options={pierreDiffOptions(resolvedTheme)}
      />
    </div>
  );
}
