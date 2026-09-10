import { useEffect, useMemo, useRef, useState } from "react";
import { CodeView, type CodeViewHandle } from "@pierre/diffs/react";
import type {
  CodeViewDiffItem,
  CodeViewOptions,
  CodeViewLineSelection,
} from "@pierre/diffs";
import {
  backgroundColor,
  border,
  Button,
  flex,
  spacing,
  text,
  useTheme,
} from "maui";
import { style, useStyles } from "purse-styles";
import type { CallStackLine, SourceReference } from "../annotations.js";
import type { SourceDefinition, DefinitionResponse } from "../definitions.js";
import { TkstackDefinitionError } from "../errors.js";
import { pierreDiffOptions, sourceSelectionCss } from "./pierre.js";

export type SourceSelection = {
  line: CallStackLine;
  reference: SourceReference;
};

type DefinitionNavigation = {
  selection: SourceSelection | undefined;
  history: SourceDefinition[];
  status: string | undefined;
};

export function SourceDiffPanel(props: {
  items: CodeViewDiffItem[];
  selection: SourceSelection | undefined;
  onSelect: (selection: SourceSelection) => void;
}) {
  const { resolvedTheme } = useTheme();
  const viewer = useRef<CodeViewHandle<undefined>>(null);
  const [navigation, setNavigation] = useState<DefinitionNavigation>({
    selection: props.selection,
    history: [],
    status: undefined,
  });
  if (navigation.selection !== props.selection) {
    setNavigation({
      selection: props.selection,
      history: [],
      status: undefined,
    });
  }
  const { history, status } = navigation;
  const request = useRef(0);
  const definition = history.at(-1);
  const panel = useStyles(styles.panel);
  const header = useStyles(styles.header);
  const links = useStyles(styles.links);
  const code = useStyles(styles.code);
  const options = pierreDiffOptions({
    themeType: resolvedTheme,
    disableFileHeader: false,
  });
  const selection = props.selection;
  const selectedLines = useMemo<CodeViewLineSelection | null>(() => {
    if (definition !== undefined)
      return {
        id: definition.path,
        range: { start: definition.start, end: definition.end },
      };
    const ref = selection?.reference;
    // oxlint-disable-next-line unicorn/no-null -- Pierre uses null for a controlled empty selection.
    if (ref === undefined) return null;
    return {
      id: ref.id,
      range: {
        start: ref.start,
        end: ref.end,
        side: ref.side === "old" ? "deletions" : "additions",
      },
    };
  }, [selection, definition]);

  useEffect(() => {
    if (selectedLines === null) return;
    viewer.current?.scrollTo({
      type: "range",
      ...selectedLines,
      align: "center",
      behavior: "instant",
    });
  }, [selectedLines]);

  const onTokenClick: CodeViewOptions<undefined>["onTokenClick"] = (
    token,
    event,
    context,
  ) => {
    if (!event.metaKey && !event.ctrlKey) return;
    event.preventDefault();
    const item = context.item;
    let filePath: string;
    let lineText: string;
    if (item.type === "file") {
      filePath = item.file.name;
      lineText = item.file.contents.split(/\r?\n/)[token.lineNumber - 1]!;
    } else {
      const side =
        "side" in token && token.side === "deletions" ? "deletion" : "addition";
      const diff = item.fileDiff;
      filePath = diff.name;
      const hunk = diff.hunks.find(
        (h) =>
          token.lineNumber >= h[`${side}Start`] &&
          token.lineNumber < h[`${side}Start`] + h[`${side}Count`],
      )!;
      const index = diff.isPartial
        ? hunk[`${side}LineIndex`] + token.lineNumber - hunk[`${side}Start`]
        : token.lineNumber - 1;
      lineText = diff[`${side}Lines`][index]!.replace(/\r?\n$/, "");
    }
    const params = new URLSearchParams({
      path: filePath,
      line: String(token.lineNumber),
      column: String(token.lineCharStart),
      text: lineText,
    });
    const currentRequest = ++request.current;
    setNavigation({ selection, history, status: "Finding definition…" });
    // oxlint-disable-next-line typescript/no-floating-promises -- Token callbacks cannot await; the request owns its status update.
    void loadDefinition(params).then((result) => {
      if (currentRequest !== request.current) return;
      setNavigation((current) => {
        if (current.selection !== selection) return current;
        if (result instanceof Error)
          return { ...current, status: result.message };
        if (result.definition === undefined)
          return {
            ...current,
            status:
              result.error === undefined
                ? "No definition found."
                : result.error,
          };
        return {
          selection,
          history: [...history, result.definition],
          status: undefined,
        };
      });
    });
  };

  return (
    <aside id="source-diff-panel" aria-label="Source changes" className={panel}>
      <div className={header}>
        <strong>
          {definition === undefined ? "Source changes" : "Symbol definition"}
        </strong>
        {definition !== undefined && (
          <Button
            variant="quiet"
            onClick={() => {
              request.current++;
              setNavigation({
                selection,
                history: history.slice(0, -1),
                status: undefined,
              });
            }}
          >
            {history.length === 1 ? "Back to diff" : "Back"}
          </Button>
        )}
        <span>⌘-click or Ctrl-click a symbol to go to its definition.</span>
        {status !== undefined && <span role="status">{status}</span>}
        {selection === undefined ? (
          <span>Select a linked call stack line to highlight its changes.</span>
        ) : (
          <>
            <span>{selection.line.text.replace(/^[+ -]/, "").trim()}</span>
            {selection.line.references.length > 1 && (
              <div className={links} aria-label="Linked changes">
                {selection.line.references.map((reference, index) => (
                  <Button
                    key={index}
                    variant={
                      reference === selection.reference ? "primary" : "quiet"
                    }
                    onClick={() =>
                      props.onSelect({ line: selection.line, reference })
                    }
                  >
                    {reference.id} · {reference.side} {reference.start}–
                    {reference.end}
                  </Button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <CodeView
        ref={viewer}
        className={code}
        items={
          definition === undefined
            ? props.items
            : [
                {
                  type: "file",
                  id: definition.path,
                  file: {
                    name: definition.path,
                    contents: definition.contents,
                  },
                },
              ]
        }
        selectedLines={selectedLines}
        disableWorkerPool
        options={{
          ...options,
          unsafeCSS: options.unsafeCSS + sourceSelectionCss,
          stickyHeaders: true,
          onTokenClick,
        }}
      />
    </aside>
  );
}

async function loadDefinition(params: URLSearchParams) {
  const response = await fetch(`/__tkstack/definition?${params}`).catch(
    (cause) =>
      new TkstackDefinitionError({
        reason: "Could not reach the definition service.",
        cause,
      }),
  );
  if (response instanceof Error) return response;
  return response
    .json()
    .then((value) => {
      // SAFETY: the local tkstack definition endpoint owns this response shape.
      return value as DefinitionResponse;
    })
    .catch(
      (cause) =>
        new TkstackDefinitionError({
          reason: "Could not read the definition response.",
          cause,
        }),
    );
}

const styles = {
  panel: style(flex({ direction: "column" }), border(["left"], "border"), {
    minWidth: 0,
    minHeight: 0,
    backgroundColor: backgroundColor.app,
    "@media (max-width: 900px)": {
      borderLeft: 0,
      borderTop: "1px solid",
      height: "45vh",
    },
  }),
  header: style(
    flex({ direction: "column" }),
    spacing.padding({ all: 4 }),
    border(["bottom"], "border"),
    text({ size: "sm", color: "lowContrast" }),
    {
      gap: "6px",
      overflowWrap: "anywhere",
      maxHeight: "35%",
      overflowY: "auto",
      flexShrink: 0,
    },
  ),
  links: style(flex({ direction: "row" }), { gap: "6px", flexWrap: "wrap" }),
  code: style({
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    overflow: "auto",
  }),
};
