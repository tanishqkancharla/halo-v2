export type Fence =
  | { kind: "mermaid"; source: string }
  | { kind: "html"; source: string }
  | { kind: "callstack"; source: string }
  | { kind: "file"; path: string; start: number; end: number; source: string }
  | { kind: "diff"; path: string | undefined; source: string }
  | { kind: "code"; lang: string; source: string };

const fileRefPattern = /^(\d+):(\d+):(.+)$/;
const diffPathPattern = /^diff:(.+)$/;

export function isCallStackSource(source: string) {
  return source.includes("└──") || source.includes("├──");
}

export function pathFromDiffSource(source: string) {
  const plus = /^\+\+\+ [ab]\/(.+)$/m.exec(source);
  if (plus?.[1] !== undefined) return plus[1];
  const minus = /^--- [ab]\/(.+)$/m.exec(source);
  if (minus?.[1] !== undefined) return minus[1];
  const comment = /^\/\/ (.+\S)\s*$/m.exec(source);
  if (comment?.[1] !== undefined) return comment[1];
  return undefined;
}

export function parseFence(lang: string, source: string): Fence {
  const trimmed = source.replace(/\n$/, "");
  if (lang === "mermaid") return { kind: "mermaid", source: trimmed };
  if (lang === "html") return { kind: "html", source: trimmed };
  if (lang === "callstack") return { kind: "callstack", source: trimmed };

  const fileRef = fileRefPattern.exec(lang);
  if (fileRef !== null) {
    return {
      kind: "file",
      start: Number(fileRef[1]),
      end: Number(fileRef[2]),
      path: fileRef[3]!,
      source: trimmed,
    };
  }

  const diffPath = diffPathPattern.exec(lang);
  if (lang === "diff" || diffPath !== null) {
    if (isCallStackSource(trimmed)) {
      return { kind: "callstack", source: trimmed };
    }
    return {
      kind: "diff",
      path: diffPath?.[1] ?? pathFromDiffSource(trimmed),
      source: trimmed,
    };
  }

  return {
    kind: "code",
    lang: lang.length === 0 ? "text" : lang,
    source: trimmed,
  };
}
