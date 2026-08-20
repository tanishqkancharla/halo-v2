import { PatchDiff } from "@pierre/diffs/react";
import { useTheme } from "maui";
import { useStyles } from "purse-styles";
import { toUnifiedDiff } from "../normalizeDiff.js";
import { pierreDiffOptions, pierreShell } from "./pierre.ts";

export function CallStackDiff(props: { source: string }) {
  const { resolvedTheme } = useTheme();
  const shell = useStyles(pierreShell);
  const patch = toUnifiedDiff(props.source, "callstack");

  return (
    <div className={shell} data-walkthrough-kind="callstack">
      <PatchDiff
        patch={patch}
        disableWorkerPool
        options={pierreDiffOptions(resolvedTheme)}
      />
    </div>
  );
}
