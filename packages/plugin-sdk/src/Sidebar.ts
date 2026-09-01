/* oxlint-disable react/no-children-prop -- React Aria requires children in props for createElement calls. */
import { createElement, type ReactElement, type ReactNode } from "react";
import { NavigationTree } from "react-aria-components/NavigationTree";
import { RouterProvider } from "react-aria-components";
import { flex } from "maui";
import { style, useStyles } from "purse-styles";
import { useLocation } from "wouter";

type SidebarProps = {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
};

export function Sidebar(props: SidebarProps): ReactElement {
  const [location, navigate] = useLocation();
  const treeClassName = useStyles(tree);
  return createElement(RouterProvider, {
    navigate,
    children: createElement(NavigationTree, {
      "aria-label": props["aria-label"],
      className: joinClassNames(treeClassName, props.className),
      selectedRoute: canonicalRoute(location),
      defaultExpandedKeys: "all",
      children: props.children,
    }),
  });
}

const tree = style(flex({ direction: "column", gap: 4 }), {
  width: "100%",
  minWidth: 0,
  outline: "none",
});

function canonicalRoute(route: string) {
  return route
    .split("/")
    .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
    .join("/");
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter((name) => name !== undefined).join(" ");
}
