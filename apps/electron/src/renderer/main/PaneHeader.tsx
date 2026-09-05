import { border, flex, flexItem, spacing, text } from "maui";
import { style, useStyles } from "purse-styles";

export function PaneHeader({
  section,
  title,
}: {
  section?: string;
  title?: string;
}) {
  const header = useStyles(headerClass);
  const titleClassName = useStyles(titleClass);
  const label = paneLabel(section, title);

  if (label === undefined) {
    return <header className={header} aria-hidden="true" />;
  }

  return (
    <header className={header} aria-label={label}>
      <div className={titleClassName}>{label}</div>
    </header>
  );
}

function paneLabel(section: string | undefined, title: string | undefined) {
  if (title === undefined) return section;
  if (section === undefined) return title;
  return `${section} / ${title}`;
}

const headerClass = style(
  flex({ align: "center" }),
  flexItem({ size: "hug" }),
  border(["bottom"], "border"),
  spacing.padding({ x: 12, y: 6 }),
  {
    minWidth: 0,
    minHeight: "36px",
    flexShrink: 0,
    alignSelf: "stretch",
    WebkitAppRegion: "drag",
  },
);

const titleClass = style(
  text({ size: "sm", fontWeight: 400, color: "lowContrast" }),
  {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "left",
  },
);
