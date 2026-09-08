import type { ReactNode } from "react";
import { RouterProvider } from "react-aria-components";
import { NavigationTree } from "react-aria-components/NavigationTree";
import { flex } from "maui";
import { style, useStyles } from "purse-styles";
import { useLocation } from "wouter";

type NavigationSidebarProps = {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
};

export function NavigationSidebar(props: NavigationSidebarProps) {
  const [location, navigate] = useLocation();
  const treeClassName = useStyles(tree);

  return (
    <RouterProvider navigate={navigate}>
      <NavigationTree
        aria-label={props["aria-label"]}
        className={joinClassNames(treeClassName, props.className)}
        selectedRoute={canonicalRoute(location)}
        defaultExpandedKeys="all"
      >
        {props.children}
      </NavigationTree>
    </RouterProvider>
  );
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
