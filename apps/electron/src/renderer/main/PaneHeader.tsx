import { border, flexItem, spacing, text } from "maui";
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
  if (title === undefined) return undefined;
  const label = section === undefined ? title : `${section} / ${title}`;
  return (
    <header className={header} aria-label={label}>
      <div className={titleClassName}>{label}</div>
    </header>
  );
}

const headerClass = style(
  flexItem({ size: "hug" }),
  border(["bottom"], "border"),
  spacing.padding({ x: 12, y: 6 }),
  {
    minWidth: 0,
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
