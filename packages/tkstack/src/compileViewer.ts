import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";

export function compileFormatForPath(filePath: string) {
  if (filePath.endsWith(".md")) return "md" as const;
  return "mdx" as const;
}

export async function compileViewerSource(input: {
  source: string;
  format: "md" | "mdx";
}) {
  return compile(input.source, {
    jsxImportSource: "react",
    providerImportSource: "@mdx-js/react",
    remarkPlugins: [remarkGfm],
    development: true,
    format: input.format,
  });
}
