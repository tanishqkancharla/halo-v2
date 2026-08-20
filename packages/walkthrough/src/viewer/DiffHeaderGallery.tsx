import type { ReactNode } from "react";
import { File, PatchDiff } from "@pierre/diffs/react";
import { Badge, colors, flex, spacing, text, useTheme } from "maui";
import { style, useStyles } from "purse-styles";
import { pierreDiffOptions, pierreFileOptions, pierreShell } from "./pierre.ts";

const samplePatch = `--- a/src/parseFence.ts
+++ b/src/parseFence.ts
@@ -1,4 +1,5 @@
 export type Fence =
   | { kind: "mermaid"; source: string }
+  | { kind: "html"; source: string }
   | { kind: "callstack"; source: string }
`;

const sampleFile = `export type Fence =
  | { kind: "mermaid"; source: string }
  | { kind: "html"; source: string }
  | { kind: "callstack"; source: string }
`;

export function DiffHeaderGallery() {
  const page = useStyles(styles.page);
  const intro = useStyles(styles.intro);
  const heading = useStyles(styles.heading);
  const lede = useStyles(styles.lede);
  const list = useStyles(styles.list);
  return (
    <div className={page}>
      <div className={intro}>
        <div className={heading}>Diff header options</div>
        <p className={lede}>
          Pierre file headers. The walkthrough uses option 1 for patches and
          option 3 for file excerpts. Drop <code>?gallery=headers</code> from
          the URL to open the walkthrough.
        </p>
      </div>
      <div className={list}>
        <Option
          n="1"
          title="Pierre default"
          note="File icon, path, and +/− counts. This is what PatchDiff uses now."
          current
        >
          <SamplePatch />
        </Option>
        <Option
          n="2"
          title="No header"
          note="disableFileHeader. Code only, no path or stats."
        >
          <SamplePatch disableFileHeader />
        </Option>
        <Option
          n="3"
          title="Line range"
          note="renderHeaderMetadata after the stats. File excerpts use this for 12–20."
        >
          <SampleFile renderHeaderMetadata={() => <span>12–20</span>} />
        </Option>
        <Option
          n="4"
          title="Kind suffix"
          note="renderHeaderFilenameSuffix after the path. A compact label for diff vs excerpt vs call stack."
        >
          <SamplePatch renderHeaderFilenameSuffix={() => <Badge>diff</Badge>} />
        </Option>
        <Option
          n="5"
          title="Custom path"
          note="renderCustomHeader replaces Pierre’s header chrome. Path only."
        >
          <SamplePatch
            renderCustomHeader={(file) => <CustomPath name={file.name} />}
          />
        </Option>
        <Option
          n="6"
          title="Collapsed"
          note="options.collapsed. Header stays, body hides."
        >
          <SamplePatch collapsed />
        </Option>
      </div>
    </div>
  );
}

function Option(props: {
  n: string;
  title: string;
  note: string;
  current?: boolean;
  children: ReactNode;
}) {
  const block = useStyles(styles.option);
  const cap = useStyles(styles.caption);
  const name = useStyles(styles.optionTitle);
  const note = useStyles(styles.note);
  return (
    <section className={block}>
      <div className={cap}>
        <div className={name}>
          {props.n}. {props.title}
          {props.current === true ? <Badge>In use</Badge> : undefined}
        </div>
        <div className={note}>{props.note}</div>
      </div>
      {props.children}
    </section>
  );
}

function SamplePatch(props: {
  disableFileHeader?: boolean;
  collapsed?: boolean;
  renderHeaderFilenameSuffix?: () => ReactNode;
  renderCustomHeader?: (file: { name: string }) => ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const shell = useStyles(pierreShell);
  const pierre = pierreDiffOptions(resolvedTheme);
  return (
    <div className={shell}>
      <PatchDiff
        patch={samplePatch}
        disableWorkerPool
        renderHeaderFilenameSuffix={props.renderHeaderFilenameSuffix}
        renderCustomHeader={props.renderCustomHeader}
        options={{
          theme: pierre.theme,
          themeType: pierre.themeType,
          overflow: pierre.overflow,
          diffStyle: pierre.diffStyle,
          unsafeCSS: pierre.unsafeCSS,
          disableFileHeader: props.disableFileHeader,
          collapsed: props.collapsed,
        }}
      />
    </div>
  );
}

function SampleFile(props: { renderHeaderMetadata: () => ReactNode }) {
  const { resolvedTheme } = useTheme();
  const shell = useStyles(pierreShell);
  const pierre = pierreFileOptions(resolvedTheme);
  return (
    <div className={shell}>
      <File
        file={{ name: "src/parseFence.ts", contents: sampleFile }}
        disableWorkerPool
        renderHeaderMetadata={props.renderHeaderMetadata}
        options={{
          theme: pierre.theme,
          themeType: pierre.themeType,
          overflow: pierre.overflow,
          unsafeCSS: pierre.unsafeCSS,
        }}
      />
    </div>
  );
}

function CustomPath(props: { name: string }) {
  const className = useStyles(styles.customPath);
  return <div className={className}>{props.name}</div>;
}

const styles = {
  page: style(
    flex({ direction: "column", gap: 8 }),
    spacing.padding({ all: 12 }),
    {
      minHeight: "100vh",
      backgroundColor: colors.gray[4],
    },
  ),
  intro: style(flex({ direction: "column", gap: 2 })),
  heading: style(text("lg", 600, "highContrast")),
  lede: style(text("sm", 400, "lowContrast"), {
    margin: 0,
  }),
  list: style(flex({ direction: "column", gap: 8 })),
  option: style(flex({ direction: "column", gap: 3 })),
  caption: style(flex({ direction: "column", gap: 1 })),
  optionTitle: style(
    flex({ direction: "row", align: "center", gap: 3 }),
    text("sm", 600, "highContrast"),
  ),
  note: style(text("xs", 400, "lowContrast")),
  customPath: style(
    text("xs", 500, "highContrast"),
    spacing.padding({ x: 4, y: 3 }),
  ),
};
