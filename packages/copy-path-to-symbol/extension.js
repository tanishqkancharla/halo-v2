const vscode = require("vscode");

const {
  findDocumentSymbolPath,
  findSymbolInformationPath,
} = require("./symbolPath.js");

function isDocumentSymbol(symbol) {
  return Array.isArray(symbol.children);
}

async function copyPathToSymbol() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    await vscode.window.showInformationMessage(
      "Open a file and select a symbol first.",
    );
    return;
  }

  const symbols = await vscode.commands.executeCommand(
    "vscode.executeDocumentSymbolProvider",
    editor.document.uri,
  );

  if (symbols === undefined || symbols.length === 0) {
    await vscode.window.showInformationMessage(
      "No symbol found at the selection.",
    );
    return;
  }

  const position = editor.selection.start;
  const symbolPath = isDocumentSymbol(symbols[0])
    ? findDocumentSymbolPath(symbols, position)
    : findSymbolInformationPath(symbols, position);

  if (symbolPath === undefined) {
    await vscode.window.showInformationMessage(
      "No symbol found at the selection.",
    );
    return;
  }

  const filePath = vscode.workspace.asRelativePath(editor.document.uri, false);
  const value = `${filePath}#${symbolPath.join(".")}`;
  await vscode.env.clipboard.writeText(value);
  vscode.window.setStatusBarMessage(`Copied ${value}`, 3000);
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("halo.copyPathToSymbol", copyPathToSymbol),
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
