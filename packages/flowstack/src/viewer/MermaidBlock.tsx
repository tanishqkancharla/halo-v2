import { useMemo } from "react";
import { renderMermaidSVG } from "beautiful-mermaid";
import * as errore from "errore";
import {
  backgroundColor,
  colors,
  fontFamily,
  radius,
  shadow,
  spacing,
} from "maui";
import { style, useStyles } from "purse-styles";
import { FlowstackMermaidError } from "../errors.js";

export function MermaidBlock(props: { source: string }) {
  const shell = useStyles(styles.shell);
  const svg = useMemo(
    () =>
      errore.try({
        try: () =>
          renderMermaidSVG(props.source, {
            bg: backgroundColor.app,
            fg: colors.gray[12],
            accent: colors.accent[9],
            muted: colors.gray[11],
            surface: backgroundColor.element,
            border: colors.gray[6],
            font: fontFamily,
            transparent: true,
          }),
        catch: (cause) => new FlowstackMermaidError({ cause }),
      }),
    [props.source],
  );
  if (svg instanceof Error) {
    return (
      <div className={shell} data-flowstack-kind="mermaid">
        {svg.message}
      </div>
    );
  }
  return (
    <div
      className={shell}
      data-flowstack-kind="mermaid"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

const styles = {
  shell: style(radius.md, shadow.subtle, spacing.padding({ all: 4 }), {
    overflowX: "auto",
    minWidth: 0,
    "& svg": {
      maxWidth: "100%",
      height: "auto",
    },
  }),
};
