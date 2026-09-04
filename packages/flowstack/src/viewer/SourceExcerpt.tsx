import { useEffect, useMemo, useState, type MouseEvent } from "react";
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

/** A line in the excerpt to point at; with `onClick`, it opens the next level. */
export type SourceMark = {
  line: number;
  onClick?: () => void;
};

export function SourceExcerpt(props: { source: Source; marks: SourceMark[] }) {
  const { resolvedTheme } = useTheme();
  const shell = useStyles(pierreShell);
  const header = useStyles(headerStyle);
  const excerpt = useFileExcerpt(props.source);
  const markedLines = useMemo(
    () => props.marks.map((mark) => mark.line),
    [props.marks],
  );

  // Pierre renders into a shadow root; the clicked row is on the composed path.
  function onClick(event: MouseEvent<HTMLDivElement>) {
    for (const target of event.nativeEvent.composedPath()) {
      if (!(target instanceof HTMLElement)) continue;
      const line = markedLine(target);
      if (line === undefined) continue;
      const mark = props.marks.find((entry) => entry.line === line);
      if (mark?.onClick !== undefined) mark.onClick();
      return;
    }
  }

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
    <div className={shell} data-flowstack-kind="source" onClick={onClick}>
      <div className={header}>
        {excerpt.path}:{excerpt.start}–{excerpt.end}
      </div>
      <PatchDiff
        patch={contextPatch(excerpt)}
        disableWorkerPool
        options={pierreDiffOptions(resolvedTheme, markedLines)}
      />
    </div>
  );
}

/** Pierre puts the line number on the number cell and the code cell. */
function markedLine(element: HTMLElement) {
  if (element.dataset.line !== undefined) return Number(element.dataset.line);
  if (element.dataset.columnNumber !== undefined) {
    return Number(element.dataset.columnNumber);
  }
  return undefined;
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
