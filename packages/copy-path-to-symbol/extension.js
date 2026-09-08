const vscode = require("vscode");
const { rangePath } = require("./rangePath.js");

const {
  findDocumentSymbolPath,
  findSymbolInformationPath,
} = require("./symbolPath.js");

function isDocumentSymbol(symbol) {
  return Array.isArray(symbol.children);
}

async function copyPath() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    await vscode.window.showInformationMessage(
      "Open a file and place the cursor or select a range first.",
    );
    return;
  }

  const filePath = vscode.workspace.asRelativePath(editor.document.uri, false);
  const selection = editor.selection;
  if (!selection.isEmpty) {
    const value = rangePath(filePath, selection);
    await vscode.env.clipboard.writeText(value);
    vscode.window.setStatusBarMessage(`Copied ${value}`, 3000);
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

  const position = selection.start;
  const symbolPath = isDocumentSymbol(symbols[0])
    ? findDocumentSymbolPath(symbols, position)
    : findSymbolInformationPath(symbols, position);

  if (symbolPath === undefined) {
    await vscode.window.showInformationMessage(
      "No symbol found at the selection.",
    );
    return;
  }

  const value = `${filePath}#${symbolPath.join(".")}`;
  await vscode.env.clipboard.writeText(value);
  vscode.window.setStatusBarMessage(`Copied ${value}`, 3000);
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("halo.copyPathToSymbol", copyPath),
    vscode.commands.registerCommand("halo.copyPathToRange", copyPath),
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
