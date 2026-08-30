import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
const sdkTypesDirectory = join(root, "dist", "sdk");
rmSync(sdkTypesDirectory, { recursive: true, force: true });
cpSync(declarationDirectory, sdkTypesDirectory, { recursive: true });
rmSync(declarationDirectory, { recursive: true, force: true });

const files = ["server.d.ts", "schema.d.ts", "storage.d.ts", "sdk/view.d.ts"];
for (const file of files) {
  const path = join(root, "dist", file);
  if (!existsSync(path)) {
    throw new Error(`missing ${path}`);
  }
}
