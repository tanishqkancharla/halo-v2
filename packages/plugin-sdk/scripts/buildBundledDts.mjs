import { cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateDtsBundle } from "dts-bundle-generator";
import ts from "typescript6";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const declarationDirectory = join(root, ".contract-types");
rmSync(declarationDirectory, { recursive: true, force: true });
const configPath = join(root, "tsconfig.json");
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error !== undefined) {
  throw new Error(
    ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"),
  );
}
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root, {
  declaration: true,
  declarationMap: false,
  emitDeclarationOnly: true,
  noEmit: false,
  outDir: declarationDirectory,
  rootDir: join(root, "src"),
});
const program = ts.createProgram({
  rootNames: [join(root, "src", "view.ts")],
  options: config.options,
});
const emitted = program.emit();
const diagnostics = [
  ...ts.getPreEmitDiagnostics(program),
  ...emitted.diagnostics,
];
if (diagnostics.length > 0) {
  throw new Error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => root,
      getNewLine: () => "\n",
    }),
  );
}
const sdkTypesDirectory = join(root, "bundled-types", "sdk");
rmSync(sdkTypesDirectory, { recursive: true, force: true });
cpSync(declarationDirectory, sdkTypesDirectory, { recursive: true });
const [viewUiTypes] = generateDtsBundle(
  [
    {
      filePath: join(root, "src", "viewUi.ts"),
      libraries: {
        inlinedLibraries: ["maui", "purse-styles", "wouter"],
        importedLibraries: ["react"],
        allowedTypesLibraries: [],
      },
      output: { noBanner: true },
    },
  ],
  { preferredConfigPath: configPath },
);
if (viewUiTypes === undefined) {
  throw new Error("view UI declarations were not generated");
}
writeFileSync(
  join(sdkTypesDirectory, "viewUi.d.ts"),
  viewUiTypes.replaceAll('import("react").React$1.', "React$1."),
);
const require = createRequire(import.meta.url);
const reactTypesDirectory = dirname(
  require.resolve("@types/react/package.json"),
);
for (const fileName of [
  "global.d.ts",
  "index.d.ts",
  "jsx-dev-runtime.d.ts",
  "jsx-runtime.d.ts",
]) {
  cpSync(
    join(reactTypesDirectory, fileName),
    join(root, "bundled-types", fileName),
  );
}
cpSync(
  require.resolve("csstype/index.d.ts"),
  join(root, "bundled-types", "csstype.d.ts"),
);
rmSync(declarationDirectory, { recursive: true, force: true });

const files = [
  "server.d.ts",
  "schema.d.ts",
  "storage.d.ts",
  "global.d.ts",
  "index.d.ts",
  "csstype.d.ts",
  "jsx-runtime.d.ts",
  "sdk/view.d.ts",
  "sdk/viewUi.d.ts",
];
for (const file of files) {
  const path = join(root, "bundled-types", file);
  if (!existsSync(path)) {
    throw new Error(`missing ${path}`);
  }
}
