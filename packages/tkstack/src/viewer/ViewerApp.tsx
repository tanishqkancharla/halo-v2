import { useEffect, useState } from "react";
import {
  backgroundColor,
  border,
  colors,
  flex,
  flexItem,
  proseHtml,
  proseMaxWidth,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import { viewerDocument } from "virtual:tkstack";
import { ComarkView } from "./ComarkView.tsx";
import { DoneButton } from "./DoneButton.tsx";

type ViewerMeta = {
  title: string;
};

export function ViewerApp() {
  const meta = useViewerMeta();
  const [shutDown, setShutDown] = useState(false);
  const title = meta === undefined ? document.title : meta.title;
  const shell = useStyles(styles.shell);
  const header = useStyles(styles.header);
  const heading = useStyles(styles.heading);
  const titleClass = useStyles(styles.title);
  const article = useStyles(styles.article);
  const prose = useStyles(styles.prose, proseHtml("md"));
  const closed = useStyles(styles.closed);

  useEffect(() => {
    if (meta === undefined) return;
    document.title = meta.title;
  }, [meta]);

  if (shutDown) {
    return <main className={closed}>Closed.</main>;
  }

  return (
    <div className={shell}>
      <header className={header}>
        <div className={heading}>
          <div className={titleClass}>{title}</div>
        </div>
        <DoneButton
          onClick={() => {
            setShutDown(true);
            void closeViewer();
          }}
        />
      </header>
      <article className={article}>
        <div className={prose}>
          <ComarkView document={viewerDocument} />
        </div>
      </article>
    </div>
  );
}

function useViewerMeta() {
  const [meta, setMeta] = useState<ViewerMeta>();
  useEffect(() => {
    void fetch("/__tkstack/meta")
      .then((response) => response.json())
      .then((value) => {
        // SAFETY: the tkstack CLI serves this shape from extractTitle.
        setMeta(value as ViewerMeta);
      });
  }, []);
  return meta;
}

async function closeViewer() {
  await fetch("/__tkstack/shutdown", { method: "POST" });
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
    border(["bottom"], "border"),
    {
      minWidth: 0,
      backgroundColor: backgroundColor.app,
    },
  ),
  heading: style(flex({ direction: "column" }), {
    minWidth: 0,
  }),
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
    "& ul > li[data-task]::before, & ol > li[data-task]::before": {
      content: "none",
    },
    "& ul > li[data-task] > .tkstack-task-checkbox, & ol > li[data-task] > .tkstack-task-checkbox":
      {
        // Maui proseHtml md listPadding.
        position: "absolute",
        left: "-20px",
        top: "6px",
      },
    "& .tkstack-task-checkbox label > span:last-child": {
      position: "absolute",
      width: "1px",
      height: "1px",
      padding: 0,
      margin: "-1px",
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      border: 0,
    },
  }),
  closed: style(text("md", 500, "highContrast"), spacing.padding({ all: 12 }), {
    minHeight: "100vh",
    backgroundColor: backgroundColor.app,
  }),
};
