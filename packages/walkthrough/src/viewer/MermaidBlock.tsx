import { useEffect, useId, useState } from "react";
import mermaid from "mermaid";
import { useTheme } from "maui";
import { radius, shadow, spacing } from "maui";
import { style, useStyles } from "purse-styles";

export function MermaidBlock(props: { source: string }) {
  const { resolvedTheme } = useTheme();
  const shell = useStyles(styles.shell);
  const reactId = useId().replaceAll(":", "");
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let cancelled = false;
    mermaid.initialize({
      startOnLoad: false,
      theme: resolvedTheme === "dark" ? "dark" : "neutral",
      securityLevel: "strict",
    });
    void mermaid
      .render(`walkthrough-mermaid-${reactId}`, props.source)
      .then((result) => {
        if (cancelled) return;
        setSvg(result.svg);
      });
    return () => {
      cancelled = true;
    };
  }, [props.source, reactId, resolvedTheme]);

  return (
    <div
      className={shell}
      data-walkthrough-kind="mermaid"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

const styles = {
  shell: style(radius.md, shadow.subtle, spacing.padding({ all: 4 }), {
    overflowX: "auto",
    minWidth: 0,
  }),
};
