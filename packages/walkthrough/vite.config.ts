import fs from "node:fs/promises";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import {
  compileFormatForPath,
  compileViewerSource,
} from "./src/compileViewer.ts";
import { extractTitle } from "./src/extractWalkthrough.ts";

function walkthroughMdxPlugin(): Plugin {
  const virtualId = "\0virtual:walkthrough";
  return {
    name: "walkthrough-mdx",
    resolveId(id) {
      if (id === "virtual:walkthrough") return virtualId;
    },
    async load(id) {
      if (id !== virtualId) return;
      const mdxPath = process.env.WALKTHROUGH_MDX;
      if (mdxPath === undefined) {
        return "export default function Walkthrough() { return null }";
      }
      const source = await fs.readFile(mdxPath, "utf8");
      const compiled = await compileViewerSource({
        source,
        format: compileFormatForPath(mdxPath),
      });
      return compiled.toString();
    },
    async transformIndexHtml(html) {
      const mdxPath = process.env.WALKTHROUGH_MDX;
      if (mdxPath === undefined) return html;
      const source = await fs.readFile(mdxPath, "utf8");
      const title = extractTitle(source);
      return html.replaceAll(
        "<title>Walkthrough</title>",
        `<title>${escapeHtml(title)}</title>`,
      );
    },
    configureServer(server) {
      const mdxPath = process.env.WALKTHROUGH_MDX;
      if (mdxPath === undefined) return;
      server.watcher.add(mdxPath);
      server.watcher.on("change", (file) => {
        if (file !== mdxPath) return;
        const mod = server.moduleGraph.getModuleById(virtualId);
        if (mod !== undefined) void server.reloadModule(mod);
      });
    },
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export default defineConfig({
  plugins: [walkthroughMdxPlugin(), react()],
  resolve: {
    dedupe: ["react", "react-dom", "purse-styles"],
  },
  clearScreen: false,
  server: {
    port: 4177,
    strictPort: false,
  },
});
