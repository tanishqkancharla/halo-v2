import { CodeBlock, Editor, backgroundColor, flex, spacing, text } from "maui";
import { style, useStyles } from "purse-styles";
import { useWorkspaceFileQuery } from "../api/ApiProvider.tsx";
import { fileKind, fileLanguage } from "./fileKind.ts";
import { PaneHeader } from "./PaneHeader.tsx";
import { useAutosaveFile } from "./useAutosaveFile.ts";

export function FilePane({ path }: { path: string }) {
  const file = useWorkspaceFileQuery(path);
  const pane = useStyles(styles.pane);
  const body = useStyles(styles.body);
  const content = useStyles(styles.content);
  const status = useStyles(styles.status);
  const kind = fileKind(path);

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
  return (
    <Editor
      content={loaded}
      onChange={autosave.onChange}
      placeholder="Write…"
      aria-label={path}
      size="md"
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
  content: style({
    width: "100%",
    minWidth: 0,
  }),
  status: style(text({ size: "sm", color: "lowContrast" })),
};
