import { useEffect, useState } from "react";
import { PatchDiff } from "@pierre/diffs/react";
import { Text, colors, spacing, text, useTheme } from "maui";
import { style, useStyles } from "purse-styles";
import type { Source } from "../model/Program.js";
import { pierreDiffOptions, pierreShell } from "./pierre.ts";

type FileExcerptPayload = {
  path: string;
  start: number;
  end: number;
  contents: string;
};

export function SourceExcerpt(props: { source: Source }) {
  const { resolvedTheme } = useTheme();
  const shell = useStyles(pierreShell);
  const header = useStyles(headerStyle);
  const excerpt = useFileExcerpt(props.source);

  if (excerpt === undefined) {
    return (
      <Text size="xs" color="lowContrast">
        Loading {props.source.path}…
      </Text>
    );
  }
  if (excerpt instanceof Error) {
    return (
      <Text size="xs" color="lowContrast">
        {excerpt.message}
      </Text>
    );
  }
  return (
    <div className={shell} data-flowstack-kind="source">
      <div className={header}>
        {excerpt.path}:{excerpt.start}–{excerpt.end}
      </div>
      <PatchDiff
        patch={contextPatch(excerpt)}
        disableWorkerPool
        options={pierreDiffOptions(resolvedTheme)}
      />
    </div>
  );
}

const headerStyle = style(
  text({ size: "xs", fontWeight: 500, color: "lowContrast" }),
  spacing.padding({ x: 4, y: 2 }),
  {
    fontFamily:
      'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    backgroundColor: colors.gray[2],
    borderBottom: `1px solid ${colors.gray[5]}`,
  },
);

/**
 * Pierre's File view always numbers from 1. A hunk of context lines keeps the
 * real line numbers, and the same view will carry real diffs later.
 */
function contextPatch(excerpt: FileExcerptPayload) {
  const lines = excerpt.contents.split("\n");
  const range = `${excerpt.start},${lines.length}`;
  return [
    `--- ${excerpt.path}`,
    `+++ ${excerpt.path}`,
    `@@ -${range} +${range} @@`,
    ...lines.map((line) => ` ${line}`),
    "",
  ].join("\n");
}

function useFileExcerpt(source: Source) {
  const [excerpt, setExcerpt] = useState<FileExcerptPayload | Error>();
  useEffect(() => {
    const params = new URLSearchParams({
      path: source.path,
      start: String(source.start),
      end: String(source.end),
    });
    let cancelled = false;
    // oxlint-disable-next-line typescript/no-floating-promises -- React effects cannot await; this request owns the excerpt update.
    void fetch(`/__flowstack/file?${params.toString()}`)
      .then((response) => response.json())
      .then((value) => {
        if (cancelled) return;
        // SAFETY: the flowstack server serves FileExcerpt JSON or { error } for this route.
        const payload = value as FileExcerptPayload | { error: string };
        if ("error" in payload) {
          setExcerpt(new Error(payload.error));
          return;
        }
        setExcerpt(payload);
      })
      .catch((cause) => {
        if (cancelled) return;
        setExcerpt(new Error(`Could not load ${source.path}`, { cause }));
      });
    return () => {
      cancelled = true;
    };
  }, [source.path, source.start, source.end]);
  return excerpt;
}
