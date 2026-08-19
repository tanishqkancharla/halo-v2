import {
  createElement,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";
import { backgroundColor, colors, navigationItem, radius, spacing } from "maui";
import { style, useStyles } from "purse-styles";
import { Link, useRoute } from "wouter";
import { sidebarPadding } from "./SidebarSection.js";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type SidebarItemProps = {
  href: string;
  children: ReactNode;
  icon?: IconComponent;
  trailing?: ReactNode;
  className?: string;
};

export function SidebarItem(props: SidebarItemProps) {
  const [isActive] = useRoute(props.href);
  const itemClassName = useStyles(itemClass);
  const listItemClassName = useStyles(listItemClass);
  const iconWrapClassName = useStyles(
    iconWrapClass,
    ...(isActive ? [iconWrapActiveClass] : []),
  );
  const iconClassName = useStyles(iconClass);
  const labelClassName = useStyles(itemLabelClass);
  const trailingClassName = useStyles(trailingClass);
  const Icon = props.icon;

  return createElement(
    "li",
    { className: listItemClassName },
    createElement(
      Link,
      {
        href: props.href,
        className: joinClassNames(itemClassName, props.className),
        "aria-current": isActive ? "page" : undefined,
      },
      createElement(
        "span",
        { className: iconWrapClassName },
        Icon === undefined
          ? undefined
          : createElement(Icon, { className: iconClassName }),
      ),
      createElement("span", { className: labelClassName }, props.children),
      props.trailing === undefined
        ? undefined
        : createElement(
            "span",
            { className: trailingClassName },
            props.trailing,
          ),
    ),
  );
}

const listItemClass = style({
  display: "block",
  width: "100%",
  minWidth: 0,
});

const itemClass = style(navigationItem, sidebarPadding, {
  display: "grid",
  gridTemplateColumns: "16px minmax(0, 1fr) auto",
  alignItems: "center",
  columnGap: spacing.value(3),
  minWidth: 0,
  width: "100%",
  borderRadius: 0,
  paddingTop: spacing.value(2),
  paddingBottom: spacing.value(2),
  border: 0,
  textDecoration: "none",
  textAlign: "left",
  backgroundColor: "transparent",
  "&[aria-current='page']": {
    backgroundColor: backgroundColor.elementActive,
    color: colors.accent[11],
  },
});

const iconWrapClass = style(radius.sm, {
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  color: colors.gray[11],
  width: "20px",
  height: "20px",
  marginBlock: "-2px",
  marginLeft: "-2px",
});

const iconWrapActiveClass = style({
  color: colors.accent[11],
});

const iconClass = style({
  width: "16px",
  height: "16px",
});

const itemLabelClass = style({
  flex: "1 1 auto",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const trailingClass = style({
  flexShrink: 0,
});

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter((name) => name !== undefined).join(" ");
}
