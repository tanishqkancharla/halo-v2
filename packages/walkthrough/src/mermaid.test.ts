import { describe, expect, test } from "vitest";
import { WalkthroughMermaidError } from "./errors.js";
import { mermaidSvg } from "./mermaid.js";

const zinc = {
  bg: "#ffffff",
  fg: "#27272a",
  accent: "#0969da",
  muted: "#71717a",
  surface: "#f4f4f5",
  border: "#d4d4d8",
  font: "sans-serif",
};

describe("mermaidSvg", () => {
  test("renders a flowchart to svg", () => {
    const svg = mermaidSvg({
      ...zinc,
      source: `flowchart TD
  A[CLI] --> B[Vite server]
  B --> C[MDX page]`,
    });
    expect(svg).not.toBeInstanceOf(Error);
    if (svg instanceof Error) return;
    expect(svg).toContain("<svg");
    expect(svg).toContain("CLI");
  });

  test("returns WalkthroughMermaidError for invalid source", () => {
    const svg = mermaidSvg({ ...zinc, source: "not a mermaid diagram" });
    expect(svg).toBeInstanceOf(WalkthroughMermaidError);
  });
});
