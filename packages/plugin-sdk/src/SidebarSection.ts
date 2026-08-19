import { createElement, useId, type AriaRole, type ReactNode } from "react";
import {
  borderColor,
  flex,
  motionDurationMs,
  motionEasing,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";

export const sidebarPadding = style(spacing.padding({ x: 3 }));

export const sidebarSection = style(
  flex({ direction: "column", gap: 4 }),
  spacing.padding({ y: 2 }),
  {
    minWidth: 0,
    width: "100%",
    borderTop: "1px solid transparent",
    borderBottom: "1px solid transparent",
    transition: `border-color ${motionDurationMs}ms ${motionEasing}`,
    "&:hover": {
      borderTopColor: borderColor.outline,
      borderBottomColor: borderColor.outline,
    },
  },
);

type SidebarSectionProps = {
  label: string;
  children: ReactNode;
  className?: string;
  role?: AriaRole;
};

export function SidebarSection(props: SidebarSectionProps) {
  const labelId = useId();
  const sectionClassName = useStyles(sidebarSection);
  const labelClassName = useStyles(sectionLabelClass);
  const bodyClassName = useStyles(sectionBodyClass);
  const role = props.role === undefined ? "list" : props.role;

  return createElement(
    "section",
    { className: joinClassNames(sectionClassName, props.className) },
    createElement(
      "div",
      { id: labelId, className: labelClassName },
      props.label,
    ),
    createElement(
      "div",
      { className: bodyClassName, role, "aria-labelledby": labelId },
      props.children,
    ),
  );
}

const sectionLabelClass = style(text("xs", 500, "lowContrast"), sidebarPadding);

const sectionBodyClass = style(flex({ direction: "column" }), {
  margin: 0,
  padding: 0,
  width: "100%",
  minWidth: 0,
  gap: "1px",
});

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter((name) => name !== undefined).join(" ");
}
