import {
  Editor,
  backgroundColor,
  flex,
  proseMaxWidth,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import { CodeBlock } from "./CodeBlock.tsx";
import { useWorkspaceFileQuery } from "../api/ApiProvider.tsx";
import { CodeViewFileEditor } from "./CodeViewFileEditor.tsx";
import { fileKind, fileLanguage } from "./fileKind.ts";
import { PaneHeader } from "./PaneHeader.tsx";
import { useAutosaveFile } from "./useAutosaveFile.ts";

export function FilePane({ path }: { path: string }) {
  const file = useWorkspaceFileQuery(path);
  const kind = fileKind(path);
  const pane = useStyles(styles.pane);
  const body = useStyles(kind === "code" ? styles.codeBody : styles.body);
  const content = useStyles(
    kind === "code" ? styles.codeContent : styles.content,
  );
  const status = useStyles(styles.status);

  return (
    <main className={pane} aria-label={path}>
      <PaneHeader section="Files" title={path} />
      <div className={body}>
        {file.isPending ? (
          <div className={status}>Loading file…</div>
        ) : file.isError ? (
          <div className={status} role="alert">
            {String(file.error)}
          </div>
        ) : (
          <div className={content} data-testid="file-page-content">
            {kind === "markdown" ? (
              <MarkdownFileEditor key={path} path={path} loaded={file.data} />
            ) : kind === "code" ? (
              <CodeViewFileEditor key={path} path={path} loaded={file.data} />
            ) : (
              <CodeBlock lang={fileLanguage(path)}>{file.data}</CodeBlock>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function MarkdownFileEditor({
  path,
  loaded,
}: {
  path: string;
  loaded: string;
}) {
  const autosave = useAutosaveFile({ path, loaded });
  const editor = useStyles(styles.markdownEditor);
  return (
    <Editor
      content={loaded}
      onChange={autosave.onChange}
      placeholder="Write…"
      aria-label={path}
      size="sm"
      className={editor}
    />
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
  body: style(spacing.padding({ all: 12 }), {
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    overflow: "auto",
    overscrollBehavior: "contain",
  }),
  codeBody: style(spacing.padding({ all: 12 }), {
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    display: "flex",
  }),
  content: style({
    width: "100%",
    maxWidth: proseMaxWidth,
    marginInline: "auto",
    minWidth: 0,
    height: "100%",
  }),
  markdownEditor: style({ minHeight: "100%" }),
  codeContent: style({
    width: "100%",
    maxWidth: proseMaxWidth,
    marginInline: "auto",
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    display: "flex",
  }),
  status: style(text({ size: "sm", color: "lowContrast" })),
};
