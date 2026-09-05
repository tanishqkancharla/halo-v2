import { useLayoutEffect, useRef } from "react";
import { CodeBlock as MauiCodeBlock } from "maui";
import { style, useStyles } from "purse-styles";

export function CodeBlock(props: { children: string; lang: string }) {
  const className = useStyles(codeBlockHostClass);
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null) return;

    function disarm() {
      for (const node of root.querySelectorAll("pre, .maui-code-block")) {
        if (
          node instanceof HTMLElement &&
          node.getAttribute("tabindex") !== "-1"
        ) {
          node.tabIndex = -1;
        }
      }
    }

    disarm();
    const observer = new MutationObserver(disarm);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["tabindex"],
    });
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef} className={className}>
      <MauiCodeBlock lang={props.lang}>{props.children}</MauiCodeBlock>
    </div>
  );
}

// Shiki's codeToHtml sets tabindex=0 on the highlighted pre, so a click or
// Tab focuses it and Chromium paints outline:auto (an orange ring).
const codeBlockHostClass = style({
  minWidth: 0,
  "&:focus, &:focus-visible, & :focus, & :focus-visible": {
    outline: "none",
  },
});
