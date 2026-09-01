import { cpSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Plugin } from "vite";
import { mauiSkillsDirName } from "../src/shared/mauiSkills.js";

const require = createRequire(import.meta.url);

export function copyMauiSkillsPlugin(): Plugin {
  let outDir = "";
  return {
    name: "copy-maui-skills",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const skills = join(
        dirname(require.resolve("maui/package.json")),
        "skills",
      );
      cpSync(skills, join(outDir, mauiSkillsDirName), { recursive: true });
    },
  };
}
