import { useEffect, useState } from "react";
import { MDXProvider } from "@mdx-js/react";
import {
  backgroundColor,
  colors,
  flex,
  flexItem,
  proseHtml,
  proseMaxWidth,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import Content from "virtual:walkthrough";
import { DoneButton } from "./DoneButton.tsx";
import { HeaderOptionsGallery } from "./HeaderOptionsGallery.tsx";
import { walkthroughComponents } from "./mdxComponents.tsx";

type WalkthroughMeta = {
  title: string;
};

export function WalkthroughApp() {
  const meta = useWalkthroughMeta();
  const [shutDown, setShutDown] = useState(false);
  const title = meta === undefined ? "Walkthrough" : meta.title;
  const shell = useStyles(styles.shell);
  const header = useStyles(styles.header);
  const titleClass = useStyles(styles.title);
  const article = useStyles(styles.article);
  const prose = useStyles(styles.prose, proseHtml("md"));
  const closed = useStyles(styles.closed);

  if (
    new URLSearchParams(window.location.search).get("gallery") === "headers"
  ) {
    return <HeaderOptionsGallery />;
  }

  if (shutDown) {
    return <main className={closed}>Walkthrough done.</main>;
  }

  return (
    <div className={shell}>
      <header className={header}>
        <div className={titleClass}>{title}</div>
        <DoneButton
          onClick={() => {
            setShutDown(true);
            void closeWalkthrough();
          }}
        />
      </header>
      <article className={article}>
        <div className={prose}>
          <MDXProvider components={walkthroughComponents}>
            <Content />
          </MDXProvider>
        </div>
      </article>
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
  article: style(spacing.padding({ x: 12, y: 12 }), {
    flex: "1 1 auto",
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
