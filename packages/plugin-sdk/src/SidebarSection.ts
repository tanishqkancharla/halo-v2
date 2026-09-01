import { createElement, type ReactElement, type ReactNode } from "react";
import {
  NavigationTreeHeader,
  NavigationTreeSection,
} from "react-aria-components/NavigationTree";
import {
  borderColor,
  flex,
  motionDurationMs,
  motionEasing,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import { SidebarSectionContext } from "./SidebarNavigationProvider.js";

export const sidebarPadding = style(spacing.padding({ x: 4 }));

export const sidebarSection = style(
  flex({ direction: "column" }),
  spacing.padding({ y: 2 }),
  {
    gap: 1,
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
};

export function SidebarSection(props: SidebarSectionProps): ReactElement {
  const sectionClassName = useStyles(sidebarSection);
  const labelClassName = useStyles(sectionLabel);
  return createElement(
    SidebarSectionContext.Provider,
    { value: props.label },
    createElement(
      NavigationTreeSection,
      { className: joinClassNames(sectionClassName, props.className) },
      createElement(
        NavigationTreeHeader,
        { className: labelClassName },
        props.label,
      ),
      props.children,
    ),
  );
}

const sectionLabel = style(
  text({ size: "xs", fontWeight: 500, color: "lowContrast" }),
  sidebarPadding,
  { marginBottom: spacing.value(3) },
);

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter((name) => name !== undefined).join(" ");
}
