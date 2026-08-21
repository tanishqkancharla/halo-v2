import fs from "node:fs/promises";
import type { Plugin } from "vite";
import { compileFormatForPath, compileViewerSource } from "./compileViewer.js";

export function tkstackContentPlugin(input: {
  filePath: string;
  title: string;
}): Plugin {
  const virtualId = "\0virtual:tkstack";
  return {
    name: "tkstack-content",
    resolveId(id) {
      if (id === "virtual:tkstack") return virtualId;
    },
    async load(id) {
      if (id !== virtualId) return;
      const source = await fs.readFile(input.filePath, "utf8");
      const compiled = await compileViewerSource({
        source,
        format: compileFormatForPath(input.filePath),
      });
      return compiled.toString();
    },
    transformIndexHtml(html) {
      return html.replaceAll(
        "<title>tkstack</title>",
        `<title>${escapeHtml(input.title)}</title>`,
      );
    },
    configureServer(server) {
      server.watcher.add(input.filePath);
      server.watcher.on("change", (file) => {
        if (file !== input.filePath) return;
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
