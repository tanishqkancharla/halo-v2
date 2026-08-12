import {
  H2,
  H3,
  P,
  Prose,
  backgroundColor,
  colors,
  flex,
  flexItem,
  shadow,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import { Filesystem } from "./patterns/Filesystem.tsx";

const mockPaths = [
  "src/renderer/App.tsx",
  "src/renderer/Sidebar.tsx",
  "src/renderer/MainPane.tsx",
  "src/main/index.ts",
  "src/shared/rpc.ts",
  "package.json",
  "README.md",
  "tsconfig.json",
] as const;

export function UiKitPage() {
  const pane = useStyles(styles.pane);
  const content = useStyles(styles.content);
  const header = useStyles(styles.header);
  const title = useStyles(styles.title);
  const preview = useStyles(styles.preview);

  return (
    <main className={pane} aria-label="UI kit">
      <div className={content}>
        <header className={header}>
          <div className={title}>UI kit</div>
        </header>
        <Prose>
          <H2>Filesystem</H2>
          <P>
            Lowkey workspace tree styled like sidebar session rows. Mock paths
            for now; later this lands in the sidebar Files section.
          </P>
          <H3>Example</H3>
          <div className={preview}>
            <Filesystem
              header="Files"
              paths={mockPaths}
              initialSelectedPath="src/renderer/App.tsx"
            />
          </div>
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
  preview: style(shadow.medium, spacing.padding({ x: 2, y: 4 }), {
    width: "240px",
    maxWidth: "100%",
    height: "360px",
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: `light-dark(${colors.gray[1]}, ${colors.gray[2]})`,
  }),
};
