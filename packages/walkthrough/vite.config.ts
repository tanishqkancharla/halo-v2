import fs from "node:fs/promises";
import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

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
      const compiled = await compile(source, {
        jsxImportSource: "react",
        providerImportSource: "@mdx-js/react",
        remarkPlugins: [remarkGfm],
        development: true,
      });
      return compiled.toString();
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
