import { useState } from "react";
import {
  H2,
  H3,
  P,
  Panel,
  Prose,
  backgroundColor,
  flex,
  flexItem,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import { Filesystem, type FilesystemNode } from "./patterns/Filesystem.tsx";

const mockWorkspace: FilesystemNode[] = [
  {
    id: "src",
    name: "src",
    kind: "directory",
    children: [
      {
        id: "src/renderer",
        name: "renderer",
        kind: "directory",
        children: [
          { id: "src/renderer/App.tsx", name: "App.tsx", kind: "file" },
          {
            id: "src/renderer/Sidebar.tsx",
            name: "Sidebar.tsx",
            kind: "file",
          },
          {
            id: "src/renderer/MainPane.tsx",
            name: "MainPane.tsx",
            kind: "file",
          },
        ],
      },
      {
        id: "src/main",
        name: "main",
        kind: "directory",
        children: [{ id: "src/main/index.ts", name: "index.ts", kind: "file" }],
      },
      { id: "src/shared", name: "shared", kind: "directory", children: [] },
    ],
  },
  {
    id: "package.json",
    name: "package.json",
    kind: "file",
  },
  {
    id: "README.md",
    name: "README.md",
    kind: "file",
  },
  {
    id: "tsconfig.json",
    name: "tsconfig.json",
    kind: "file",
  },
];

export function UiKitPage() {
  const [selectedId, setSelectedId] = useState<string | null>(
    "src/renderer/App.tsx",
  );
  const pane = useStyles(styles.pane);
  const content = useStyles(styles.content);
  const header = useStyles(styles.header);
  const title = useStyles(styles.title);
  const panel = useStyles(styles.panel);

  return (
    <main className={pane} aria-label="UI kit">
      <div className={content}>
        <header className={header}>
          <div className={title}>UI kit</div>
        </header>
        <Prose>
          <H2>Filesystem</H2>
          <P>
            Interactive workspace tree for browsing folders and files. Mock data
            for now; later this will back the sidebar filesystem section.
          </P>
          <H3>Example</H3>
          <Panel className={panel}>
            <Filesystem
              rootLabel="workspace"
              items={mockWorkspace}
              selectedId={selectedId}
              onSelectionChange={setSelectedId}
            />
          </Panel>
        </Prose>
      </div>
    </main>
  );
}

const styles = {
  pane: style(
    flex({ direction: "column" }),
    spacing.padding({ x: 12, y: 12 }),
    {
      width: "100%",
      marginInline: "auto",
      minWidth: 0,
      minHeight: 0,
      overflow: "hidden",
      backgroundColor: backgroundColor.app,
    },
  ),
  content: style(flex({ direction: "column", gap: 6 }), {
    flex: "1 1 auto",
    width: "100%",
    maxWidth: "72ch",
    minWidth: 0,
    minHeight: 0,
    marginInline: "auto",
    overflowY: "auto",
  }),
  header: style(flexItem({ size: "hug" }), text("md", 600, "highContrast"), {
    minWidth: 0,
    height: "1lh",
    overflow: "hidden",
  }),
  title: style({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  panel: style({
    padding: "16px",
    overflowX: "auto",
  }),
};
