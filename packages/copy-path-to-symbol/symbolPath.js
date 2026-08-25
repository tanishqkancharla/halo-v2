function findDocumentSymbolPath(symbols, position, parents = []) {
  const symbol = symbols.find((candidate) =>
    candidate.range.contains(position),
  );
  if (symbol === undefined) return undefined;

  const path = [...parents, symbol.name];
  const childPath = findDocumentSymbolPath(symbol.children, position, path);
  if (childPath !== undefined) return childPath;
  return path;
}

function findSymbolInformationPath(symbols, position) {
  const matchingSymbols = symbols
    .filter((symbol) => symbol.location.range.contains(position))
    .sort((left, right) => {
      const leftLines =
        left.location.range.end.line - left.location.range.start.line;
      const rightLines =
        right.location.range.end.line - right.location.range.start.line;
      return leftLines - rightLines;
    });

  const symbol = matchingSymbols[0];
  if (symbol === undefined) return undefined;
  if (symbol.containerName.length === 0) return [symbol.name];
  return [symbol.containerName, symbol.name];
}

module.exports = { findDocumentSymbolPath, findSymbolInformationPath };
