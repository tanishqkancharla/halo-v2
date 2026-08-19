export function toUnifiedDiff(source: string, path: string) {
  if (/^--- /m.test(source) && /^\+\+\+ /m.test(source)) return source;

  const lines = source.split("\n");
  const first = lines[0];
  const body =
    first !== undefined && first.startsWith("// ") ? lines.slice(1) : lines;
  const normalized = body.map((line) => {
    if (
      line.startsWith("+") ||
      line.startsWith("-") ||
      line.startsWith(" ") ||
      line.startsWith("\\")
    ) {
      return line;
    }
    return ` ${line}`;
  });

  let oldCount = 0;
  let newCount = 0;
  for (const line of normalized) {
    if (line.startsWith("+")) {
      newCount += 1;
      continue;
    }
    if (line.startsWith("-")) {
      oldCount += 1;
      continue;
    }
    if (line.startsWith("\\")) continue;
    oldCount += 1;
    newCount += 1;
  }

  const oldRange = oldCount === 0 ? "-0,0" : `-1,${oldCount}`;
  const newRange = newCount === 0 ? "+0,0" : `+1,${newCount}`;
  return `--- a/${path}\n+++ b/${path}\n@@ ${oldRange} ${newRange} @@\n${normalized.join("\n")}\n`;
}
