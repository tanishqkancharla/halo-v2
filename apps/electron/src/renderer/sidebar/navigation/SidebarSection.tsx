import type { ReactNode } from "react";
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

export const sidebarPadding = style(spacing.padding({ x: 4 }));

const sidebarSection = style(
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

export function SidebarSection(props: SidebarSectionProps) {
  const sectionClassName = useStyles(sidebarSection);
  const labelClassName = useStyles(sectionLabel);

  return (
    <NavigationTreeSection
      className={joinClassNames(sectionClassName, props.className)}
    >
      <NavigationTreeHeader className={labelClassName}>
        {props.label}
      </NavigationTreeHeader>
      {props.children}
    </NavigationTreeSection>
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
