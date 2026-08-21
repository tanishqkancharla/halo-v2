import { border, flexItem, spacing, text } from "maui";
import { style, useStyles } from "purse-styles";

export function ThreadHeader({ title }: { title?: string }) {
  const header = useStyles(headerClass);
  const titleClassName = useStyles(titleClass);
  if (title === undefined) return undefined;
  return (
    <header className={header} aria-label={title}>
      <div className={titleClassName}>{title}</div>
    </header>
  );
}

const headerClass = style(
  flexItem({ size: "hug" }),
  border(["bottom"], "border"),
  spacing.padding({ x: 12, top: 6, bottom: 12 }),
  {
    minWidth: 0,
    alignSelf: "stretch",
  },
);

const titleClass = style(text("sm", 400, "lowContrast"), {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textAlign: "left",
});
