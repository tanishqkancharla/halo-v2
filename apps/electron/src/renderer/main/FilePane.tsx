import { CodeBlock, backgroundColor, flex, spacing, text } from "maui";
import { style, useStyles } from "purse-styles";
import { useWorkspaceFileQuery } from "../api/ApiProvider.tsx";
import { PaneHeader } from "./PaneHeader.tsx";

export function FilePane({ path }: { path: string }) {
  const file = useWorkspaceFileQuery(path);
  const pane = useStyles(styles.pane);
  const body = useStyles(styles.body);
  const content = useStyles(styles.content);
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
            <CodeBlock lang={fileLanguage(path)}>{file.data}</CodeBlock>
          </div>
        )}
      </div>
    </main>
  );
}

function fileLanguage(path: string) {
  const extension = path.split(".").at(-1)?.toLowerCase();
  if (extension === "ts") return "typescript";
  if (extension === "js" || extension === "mjs" || extension === "cjs") {
    return "javascript";
  }
  if (extension === "tsx") return "tsx";
  if (extension === "css") return "css";
  if (extension === "json") return "json";
  if (extension === "sh") return "bash";
  return "text";
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
