const vscode = require("vscode");
const { rangePath } = require("./rangePath.js");

async function copyPath() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    await vscode.window.showInformationMessage(
      "Open a file and place the cursor or select a range first.",
    );
    return;
  }

  const filePath = vscode.workspace.asRelativePath(editor.document.uri, false);
  const value = rangePath(filePath, editor.selection);
  await vscode.env.clipboard.writeText(value);
  vscode.window.setStatusBarMessage(`Copied ${value}`, 3000);
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("halo.copyPathToSelection", copyPath),
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
