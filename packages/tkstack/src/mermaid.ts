import { renderMermaidSVG } from "beautiful-mermaid";
import * as errore from "errore";
import { TkstackMermaidError } from "./errors.js";

export function mermaidSvg(input: {
  source: string;
  bg: string;
  fg: string;
  accent: string;
  muted: string;
  surface: string;
  border: string;
  font: string;
}) {
  return errore.try({
    try: () =>
      renderMermaidSVG(input.source, {
        bg: input.bg,
        fg: input.fg,
        accent: input.accent,
        muted: input.muted,
        surface: input.surface,
        border: input.border,
        font: input.font,
        transparent: true,
      }),
    catch: (cause) => new TkstackMermaidError({ cause }),
  });
}
