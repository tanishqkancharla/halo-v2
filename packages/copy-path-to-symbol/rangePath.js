function rangePath(filePath, selection) {
  const startLine = selection.start.line + 1;
  // VS Code selections end exclusively, so column zero excludes that line.
  const endLine =
    selection.end.character === 0 ? selection.end.line : selection.end.line + 1;
  return startLine === endLine
    ? `${filePath}:${startLine}`
    : `${filePath}:${startLine}-${endLine}`;
}

module.exports = { rangePath };
