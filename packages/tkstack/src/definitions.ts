import path from "node:path";
import ts from "typescript6";
import * as errore from "errore";
import { TkstackDefinitionError } from "./errors.js";

export type SourceDefinition = {
  path: string;
  contents: string;
  start: number;
  end: number;
};

export type DefinitionResponse = {
  definition?: SourceDefinition;
  error?: string;
};

export function findDefinition(workspaceRoot: string, params: URLSearchParams) {
  const requestedPath = params.get("path");
  const line = Number(params.get("line"));
  const column = Number(params.get("column"));
  const lineText = params.get("text");
  if (
    requestedPath === null ||
    lineText === null ||
    !Number.isSafeInteger(line) ||
    line < 1 ||
    !Number.isSafeInteger(column) ||
    column < 0
  )
    return new TkstackDefinitionError({ reason: "Invalid source position." });

  const fileName = path.resolve(workspaceRoot, requestedPath);
  if (!fileName.startsWith(workspaceRoot + path.sep)) {
    return new TkstackDefinitionError({
      reason: "Path escapes the workspace.",
    });
  }
  if (!/\.[cm]?[jt]sx?$/i.test(fileName)) {
    return new TkstackDefinitionError({
      reason: "Definition navigation supports TypeScript and JavaScript.",
    });
  }
  const contents = ts.sys.readFile(fileName);
  if (contents === undefined) {
    return new TkstackDefinitionError({
      reason: "This file is no longer in the workspace.",
    });
  }
  const lines = contents.split(/\r?\n/);
  if (lines[line - 1] !== lineText || column >= lineText.length) {
    return new TkstackDefinitionError({
      reason:
        "This diff line differs from the current workspace. Its definition cannot be resolved.",
    });
  }
  const configPath = ts.findConfigFile(
    path.dirname(fileName),
    ts.sys.fileExists,
  );
  let options: ts.CompilerOptions = {
    allowJs: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
  };
  if (configPath !== undefined) {
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    if (config.error !== undefined) {
      return new TkstackDefinitionError({
        reason: ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
      });
    }
    const parsed = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      path.dirname(configPath),
    );
    options = { ...options, ...parsed.options, allowJs: true };
  }

  const service = ts.createLanguageService({
    ...ts.sys,
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
    getCompilationSettings: () => options,
    getScriptFileNames: () => [fileName],
    getScriptVersion: () => "0",
    getScriptSnapshot: (name) => {
      const source = ts.sys.readFile(name);
      return source === undefined
        ? undefined
        : ts.ScriptSnapshot.fromString(source);
    },
    getCurrentDirectory: () => workspaceRoot,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
  });
  using resources = new errore.DisposableStack();
  resources.defer(() => service.dispose());
  const source = service.getProgram()!.getSourceFile(fileName)!;
  const position = source.getPositionOfLineAndCharacter(line - 1, column);
  const definition = service.getDefinitionAtPosition(fileName, position)?.[0];
  if (definition === undefined) {
    return undefined;
  }
  const target = service.getProgram()!.getSourceFile(definition.fileName)!;
  const result: SourceDefinition = {
    path: path.relative(workspaceRoot, definition.fileName),
    contents: target.text,
    start:
      target.getLineAndCharacterOfPosition(definition.textSpan.start).line + 1,
    end:
      target.getLineAndCharacterOfPosition(
        definition.textSpan.start + definition.textSpan.length,
      ).line + 1,
  };
  return result;
}
