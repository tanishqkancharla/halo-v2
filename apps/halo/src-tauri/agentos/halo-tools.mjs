import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";

const BEGIN_PATCH = "*** Begin Patch";
const END_PATCH = "*** End Patch";
const ADD_FILE = "*** Add File: ";
const DELETE_FILE = "*** Delete File: ";
const UPDATE_FILE = "*** Update File: ";
const MOVE_TO = "*** Move to: ";
const EOF_MARKER = "*** End of File";
const CHANGE_CONTEXT = "@@ ";
const EMPTY_CHANGE_CONTEXT = "@@";

function toolPath(cwd, path) {
  return resolve(cwd, path.replace(/^@/, ""));
}

function detectLineEnding(content) {
  const crlfIndex = content.indexOf("\r\n");
  const lfIndex = content.indexOf("\n");
  if (lfIndex === -1 || crlfIndex === -1) return "\n";
  return crlfIndex < lfIndex ? "\r\n" : "\n";
}

function normalizeToLf(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function restoreLineEndings(text, ending) {
  return ending === "\r\n" ? text.replace(/\n/g, "\r\n") : text;
}

function stripBom(content) {
  if (content.startsWith("\uFEFF")) {
    return { bom: "\uFEFF", text: content.slice(1) };
  }
  return { bom: "", text: content };
}

function normalizeForFuzzyMatch(text) {
  return text
    .normalize("NFKC")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
    .replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g, " ");
}

function fuzzyFindText(content, oldText) {
  const exactIndex = content.indexOf(oldText);
  if (exactIndex !== -1) {
    return {
      found: true,
      index: exactIndex,
      matchLength: oldText.length,
      contentForReplacement: content,
    };
  }

  const fuzzyContent = normalizeForFuzzyMatch(content);
  const fuzzyOldText = normalizeForFuzzyMatch(oldText);
  const fuzzyIndex = fuzzyContent.indexOf(fuzzyOldText);
  if (fuzzyIndex === -1) {
    return { found: false };
  }
  return {
    found: true,
    index: fuzzyIndex,
    matchLength: fuzzyOldText.length,
    contentForReplacement: fuzzyContent,
  };
}

async function editFile(cwd, path, oldText, newText, replaceAll = false) {
  if (oldText === newText) {
    throw new Error("oldText and newText must be different");
  }
  if (oldText.length === 0) {
    throw new Error("oldText must not be empty");
  }

  const absolutePath = toolPath(cwd, path);
  const rawContent = await readFile(absolutePath, "utf8");
  const { bom, text } = stripBom(rawContent);
  const lineEnding = detectLineEnding(text);
  const content = normalizeToLf(text);
  const normalizedOldText = normalizeToLf(oldText);
  const normalizedNewText = normalizeToLf(newText);
  let newContent;

  if (replaceAll) {
    const occurrences = content.split(normalizedOldText).length - 1;
    if (occurrences === 0) {
      throw new Error(
        `oldText not found in ${absolutePath}. Make sure it matches the file content exactly, including whitespace and indentation.`,
      );
    }
    newContent = content.split(normalizedOldText).join(normalizedNewText);
  } else {
    const match = fuzzyFindText(content, normalizedOldText);
    if (!match.found) {
      throw new Error(
        `Could not find the exact text in ${absolutePath}. The old text must match exactly including all whitespace and newlines.`,
      );
    }
    const fuzzyContent = normalizeForFuzzyMatch(content);
    const fuzzyOldText = normalizeForFuzzyMatch(normalizedOldText);
    const occurrences = fuzzyContent.split(fuzzyOldText).length - 1;
    if (occurrences > 1) {
      throw new Error(
        `Found ${occurrences} occurrences of the text in ${absolutePath}. The text must be unique. Please provide more context to make it unique.`,
      );
    }
    const base = match.contentForReplacement;
    newContent =
      base.substring(0, match.index) +
      normalizedNewText +
      base.substring(match.index + match.matchLength);
  }

  await writeFile(
    absolutePath,
    bom + restoreLineEndings(newContent, lineEnding),
    "utf8",
  );
}

function parsePatch(patchText) {
  let lines = patchText.trim().split("\n");
  if (
    lines.length >= 4 &&
    ["<<EOF", "<<'EOF'", '<<"EOF"'].includes(lines[0]) &&
    lines[lines.length - 1].endsWith("EOF")
  ) {
    lines = lines.slice(1, -1);
  }

  const first = lines[0]?.trim();
  const last = lines[lines.length - 1]?.trim();
  if (first !== BEGIN_PATCH) {
    throw new Error(
      `Invalid patch: first line must be '${BEGIN_PATCH}', got '${first}'`,
    );
  }
  if (last !== END_PATCH) {
    throw new Error(
      `Invalid patch: last line must be '${END_PATCH}', got '${last}'`,
    );
  }

  const hunks = [];
  let index = 1;
  const end = lines.length - 1;
  while (index < end) {
    const line = lines[index].trim();
    if (line.startsWith(ADD_FILE)) {
      const path = line.slice(ADD_FILE.length);
      let contents = "";
      index += 1;
      while (index < end && lines[index].startsWith("+")) {
        contents += `${lines[index].slice(1)}\n`;
        index += 1;
      }
      hunks.push({ type: "add", path, contents });
      continue;
    }
    if (line.startsWith(DELETE_FILE)) {
      hunks.push({ type: "delete", path: line.slice(DELETE_FILE.length) });
      index += 1;
      continue;
    }
    if (line.startsWith(UPDATE_FILE)) {
      const path = line.slice(UPDATE_FILE.length);
      index += 1;
      let movePath = null;
      if (index < end && lines[index].startsWith(MOVE_TO)) {
        movePath = lines[index].slice(MOVE_TO.length);
        index += 1;
      }
      const chunks = [];
      while (index < end) {
        if (lines[index].trim() === "") {
          index += 1;
          continue;
        }
        if (lines[index].startsWith("***")) break;
        const parsed = parseUpdateChunk(
          lines,
          index,
          end,
          chunks.length === 0,
        );
        chunks.push(parsed.chunk);
        index += parsed.linesConsumed;
      }
      if (chunks.length === 0) {
        throw new Error(`Update file hunk for '${path}' is empty`);
      }
      hunks.push({ type: "update", path, movePath, chunks });
      continue;
    }
    throw new Error(`Unexpected line at position ${index + 1}: '${line}'`);
  }
  return hunks;
}

function parseUpdateChunk(lines, start, end, allowMissingContext) {
  let index = start;
  const changeContext = [];
  let sawContextMarker = false;
  while (index < end) {
    if (lines[index] === EMPTY_CHANGE_CONTEXT) {
      sawContextMarker = true;
      index += 1;
      continue;
    }
    if (lines[index].startsWith(CHANGE_CONTEXT)) {
      sawContextMarker = true;
      changeContext.push(lines[index].slice(CHANGE_CONTEXT.length));
      index += 1;
      continue;
    }
    break;
  }
  if (!sawContextMarker && !allowMissingContext) {
    throw new Error(
      `Expected @@ context marker at line ${index + 1}, got: '${lines[index]}'`,
    );
  }

  const oldLines = [];
  const newLines = [];
  let isEndOfFile = false;
  let parsedDiffLines = 0;
  while (index < end) {
    const line = lines[index];
    if (line === EOF_MARKER) {
      if (parsedDiffLines === 0) {
        throw new Error(
          `Update hunk at line ${start + 1} has no diff lines before End of File`,
        );
      }
      isEndOfFile = true;
      index += 1;
      break;
    }

    const prefix = line[0];
    if (prefix === " ") {
      oldLines.push(line.slice(1));
      newLines.push(line.slice(1));
    } else if (prefix === "+") {
      newLines.push(line.slice(1));
    } else if (prefix === "-") {
      oldLines.push(line.slice(1));
    } else if (line === "") {
      oldLines.push("");
      newLines.push("");
    } else if (line.startsWith(CHANGE_CONTEXT) || line === EMPTY_CHANGE_CONTEXT) {
      break;
    } else if (parsedDiffLines === 0) {
      throw new Error(
        `Unexpected line in update hunk at line ${index + 1}: '${line}'. Lines must start with ' ', '+', or '-'`,
      );
    } else {
      break;
    }
    parsedDiffLines += 1;
    index += 1;
  }

  return {
    chunk: { changeContext, oldLines, newLines, isEndOfFile },
    linesConsumed: index - start,
  };
}

function normalizePatchText(text) {
  return text
    .trim()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C-\u201F]/g, '"')
    .replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g, " ");
}

function seekSequence(lines, pattern, start, endOfFile) {
  if (pattern.length === 0) return start;
  if (pattern.length > lines.length) return null;
  const searchStart = endOfFile ? lines.length - pattern.length : start;
  const comparisons = [
    (left, right) => left === right,
    (left, right) => left.trimEnd() === right.trimEnd(),
    (left, right) => left.trim() === right.trim(),
    (left, right) => normalizePatchText(left) === normalizePatchText(right),
  ];
  for (const compare of comparisons) {
    for (
      let index = searchStart;
      index <= lines.length - pattern.length;
      index += 1
    ) {
      if (pattern.every((line, offset) => compare(lines[index + offset], line))) {
        return index;
      }
    }
  }
  return null;
}

function seekContextHeader(lines, header, start) {
  const exact = seekSequence(lines, [header], start, false);
  if (exact !== null) return exact;
  const needle = normalizePatchText(header);
  if (needle.length === 0) return start;
  for (let index = start; index < lines.length; index += 1) {
    if (normalizePatchText(lines[index]).includes(needle)) return index;
  }
  return null;
}

function planUpdate(originalContent, path, chunks, movePath) {
  const originalLines = originalContent.split("\n");
  if (originalLines[originalLines.length - 1] === "") originalLines.pop();
  const replacements = [];
  let lineIndex = 0;

  for (const chunk of chunks) {
    for (const context of chunk.changeContext) {
      const contextIndex = seekContextHeader(originalLines, context, lineIndex);
      if (contextIndex === null) {
        throw new Error(`Failed to find context '${context}' in ${path}`);
      }
      lineIndex = contextIndex + 1;
    }

    if (chunk.oldLines.length === 0) {
      replacements.push({
        startIndex: chunk.changeContext.length > 0 ? lineIndex : originalLines.length,
        oldLength: 0,
        newLines: chunk.newLines,
      });
      continue;
    }

    let pattern = chunk.oldLines;
    let newLines = chunk.newLines;
    let found = seekSequence(
      originalLines,
      pattern,
      lineIndex,
      chunk.isEndOfFile,
    );
    if (
      found === null &&
      pattern.length > 0 &&
      pattern[pattern.length - 1] === ""
    ) {
      pattern = pattern.slice(0, -1);
      if (newLines[newLines.length - 1] === "") {
        newLines = newLines.slice(0, -1);
      }
      found = seekSequence(
        originalLines,
        pattern,
        lineIndex,
        chunk.isEndOfFile,
      );
    }
    if (found === null) {
      throw new Error(
        `Failed to find expected lines in ${path}:\n${chunk.oldLines.join("\n")}`,
      );
    }
    replacements.push({
      startIndex: found,
      oldLength: pattern.length,
      newLines,
    });
    lineIndex = found + pattern.length;
  }

  replacements.sort((left, right) => left.startIndex - right.startIndex);
  return { path, movePath, originalContent, replacements };
}

function applyPlannedUpdate(plan) {
  const lines = plan.originalContent.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  for (const replacement of [...plan.replacements].reverse()) {
    lines.splice(
      replacement.startIndex,
      replacement.oldLength,
      ...replacement.newLines,
    );
  }
  if (lines[lines.length - 1] !== "") lines.push("");
  return lines.join("\n");
}

function summarizePatch(added, modified, deleted) {
  const lines = ["Updated the following files:"];
  for (const path of added) lines.push(`A ${path}`);
  for (const path of modified) lines.push(`M ${path}`);
  for (const path of deleted) lines.push(`D ${path}`);
  return lines.join("\n");
}

async function applyPatch(cwd, patchText) {
  const hunks = parsePatch(patchText);
  if (hunks.length === 0) throw new Error("No files were modified.");

  const updates = new Map();
  const added = [];
  const modified = [];
  const deleted = [];
  for (const hunk of hunks) {
    if (hunk.type === "add") added.push(hunk.path);
    if (hunk.type === "delete") deleted.push(hunk.path);
    if (hunk.type === "update") {
      const originalContent = await readFile(toolPath(cwd, hunk.path), "utf8");
      updates.set(
        hunk.path,
        planUpdate(originalContent, hunk.path, hunk.chunks, hunk.movePath),
      );
      modified.push(hunk.movePath === null ? hunk.path : hunk.movePath);
    }
  }

  for (const hunk of hunks) {
    const absolutePath = toolPath(cwd, hunk.path);
    if (hunk.type === "add") {
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, hunk.contents);
    }
    if (hunk.type === "delete") {
      await unlink(absolutePath);
    }
    if (hunk.type === "update") {
      const plan = updates.get(hunk.path);
      const destination =
        hunk.movePath === null ? absolutePath : toolPath(cwd, hunk.movePath);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, applyPlannedUpdate(plan));
      if (hunk.movePath !== null) await unlink(absolutePath);
    }
  }

  return summarizePatch(added, modified, deleted);
}

function bash(cwd, command) {
  return new Promise((resolveResult, reject) => {
    const child = spawn("sh", ["-lc", command], { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolveResult({ stdout, stderr, exitCode });
    });
  });
}

export function createTools(cwd) {
  return {
    files: {
      read(path) {
        return readFile(toolPath(cwd, path), "utf8");
      },
      async write(path, content) {
        const absolutePath = toolPath(cwd, path);
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, content, "utf8");
      },
      edit(path, oldText, newText, replaceAll = false) {
        return editFile(cwd, path, oldText, newText, replaceAll);
      },
      patch(patchText) {
        return applyPatch(cwd, patchText);
      },
    },
    shell: {
      bash(command) {
        return bash(cwd, command);
      },
    },
  };
}
