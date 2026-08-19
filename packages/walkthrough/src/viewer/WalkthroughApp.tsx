import { useEffect, useState } from "react";
import { MDXProvider } from "@mdx-js/react";
import {
  Button,
  Icons,
  backgroundColor,
  colors,
  flex,
  flexItem,
  icon,
  proseHtml,
  proseMaxWidth,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import Content from "virtual:walkthrough";
import type { WalkthroughFile } from "../extractWalkthrough.js";
import { ChangedFilesTree } from "./ChangedFilesTree.tsx";
import { walkthroughComponents } from "./mdxComponents.tsx";

type WalkthroughMeta = {
  title: string;
  files: WalkthroughFile[];
};

export function WalkthroughApp() {
  const meta = useWalkthroughMeta();
  const [shutDown, setShutDown] = useState(false);
  const files = meta === undefined ? [] : meta.files;
  const title = meta === undefined ? "Walkthrough" : meta.title;
  const shell = useStyles(styles.shell);
  const header = useStyles(styles.header);
  const titleClass = useStyles(styles.title);
  const closeIcon = useStyles(icon("sm"));
  const body = useStyles(
    styles.body,
    files.length === 0 ? styles.bodySolo : undefined,
  );
  const aside = useStyles(styles.aside);
  const article = useStyles(styles.article);
  const prose = useStyles(styles.prose, proseHtml("md"));
  const closed = useStyles(styles.closed);

  if (shutDown) {
    return <main className={closed}>Walkthrough closed.</main>;
  }

  return (
    <div className={shell}>
      <header className={header}>
        <div className={titleClass}>{title}</div>
        <Button
          variant="quiet"
          aria-label="Close"
          onClick={() => {
            void closeWalkthrough().then(() => {
              setShutDown(true);
            });
          }}
        >
          <Icons.CircleX className={closeIcon} />
        </Button>
      </header>
      <div className={body}>
        {files.length === 0 ? undefined : (
          <aside className={aside} aria-label="Changed files">
            <ChangedFilesTree
              files={files}
              onSelect={(path) => {
                document
                  .querySelector(`[data-file-path="${CSS.escape(path)}"]`)
                  ?.scrollIntoView({ block: "start" });
              }}
            />
          </aside>
        )}
        <article className={article}>
          <div className={prose}>
            <MDXProvider components={walkthroughComponents}>
              <Content />
            </MDXProvider>
          </div>
        </article>
      </div>
    </div>
  );
}

function useWalkthroughMeta() {
  const [meta, setMeta] = useState<WalkthroughMeta>();
  useEffect(() => {
    void fetch("/__walkthrough/meta")
      .then((response) => response.json())
      .then((value) => {
        // SAFETY: the walkthrough CLI serves this shape from extractWalkthrough.
        setMeta(value as WalkthroughMeta);
      });
  }, []);
  return meta;
}

async function closeWalkthrough() {
  await fetch("/__walkthrough/shutdown", { method: "POST" });
}

const styles = {
  shell: style(flex({ direction: "column" }), {
    width: "100%",
    height: "100vh",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: colors.gray[4],
  }),
  header: style(
    flex({ direction: "row", align: "center", justify: "between" }),
    spacing.padding({ x: 6, y: 3 }),
    flexItem({ size: "hug" }),
    {
      minWidth: 0,
      backgroundColor: backgroundColor.app,
    },
  ),
  title: style(text("md", 600, "highContrast"), {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  body: style({
    display: "grid",
    gridTemplateColumns: "240px minmax(0, 1fr)",
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    "@media (max-width: 720px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  }),
  bodySolo: style({
    gridTemplateColumns: "minmax(0, 1fr)",
  }),
  aside: style({
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: backgroundColor.app,
    "@media (max-width: 720px)": {
      display: "none",
    },
  }),
  article: style(spacing.padding({ x: 12, y: 12 }), {
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
    backgroundColor: backgroundColor.app,
  }),
  prose: style({
    width: "100%",
    maxWidth: proseMaxWidth,
    marginInline: "auto",
    minWidth: 0,
  }),
  closed: style(text("md", 500, "highContrast"), spacing.padding({ all: 12 }), {
    minHeight: "100vh",
    backgroundColor: backgroundColor.app,
  }),
};
