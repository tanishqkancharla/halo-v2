import { createElement, useId, type ReactNode } from "react";
import { flex, spacing, text } from "maui";
import { style, useStyles } from "purse-styles";
import { sidebarPadding } from "./sidebar.js";

type SidebarSectionProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function SidebarSection(props: SidebarSectionProps) {
  const labelId = useId();
  const sectionClassName = useStyles(sectionClass);
  const labelClassName = useStyles(sectionLabelClass);
  const listClassName = useStyles(sectionListClass);

  return createElement(
    "section",
    { className: joinClassNames(sectionClassName, props.className) },
    createElement(
      "div",
      { id: labelId, className: labelClassName },
      props.label,
    ),
    createElement(
      "ul",
      { className: listClassName, "aria-labelledby": labelId },
      props.children,
    ),
  );
}

const sectionClass = style(flex({ direction: "column", gap: 4 }), {
  minWidth: 0,
  width: "100%",
  marginTop: spacing.value(4),
});

const sectionLabelClass = style(
  text("xs", 500, "lowContrast"),
  sidebarPadding,
  {
    letterSpacing: "0.02em",
  },
);

const sectionListClass = style(flex({ direction: "column" }), {
  listStyleType: "none",
  margin: 0,
  padding: 0,
  width: "100%",
  minWidth: 0,
  gap: "1px",
});

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter((name) => name !== undefined).join(" ");
}
