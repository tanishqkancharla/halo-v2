import { describe, expect, test } from "vitest";
import {
  extractFences,
  extractTitle,
  filesFromFences,
  mergeWalkthroughFiles,
} from "./extractWalkthrough.js";

const sample = `# Input validation

## Check first

\`\`\`mermaid
flowchart TD
  A[Handler] --> B[Validate]
\`\`\`

\`\`\`12:14:src/handler.ts
async function requestHandler() {}
\`\`\`

\`\`\`diff
--- a/src/service.ts
+++ b/src/service.ts
@@ -1 +1 @@
-old
+new
\`\`\`

\`\`\`tree
src/handler.ts
src/new.ts
\`\`\`
`;

describe("extractWalkthrough", () => {
  test("reads the title and every fence", () => {
    expect(extractTitle(sample)).toBe("Input validation");
    const fences = extractFences(sample);
    expect(fences.map((fence) => fence.kind)).toEqual([
      "mermaid",
      "file",
      "diff",
      "tree",
    ]);
  });

  test("collects file paths from file, diff, and tree fences", () => {
    expect(filesFromFences(extractFences(sample))).toEqual([
      { path: "src/handler.ts", status: "modified" },
      { path: "src/service.ts", status: "modified" },
      { path: "src/new.ts", status: "modified" },
    ]);
  });

  test("keeps git status when merging fence paths", () => {
    expect(
      mergeWalkthroughFiles(
        [{ path: "src/handler.ts", status: "added" }],
        [
          { path: "src/handler.ts", status: "modified" },
          { path: "src/new.ts", status: "modified" },
        ],
      ),
    ).toEqual([
      { path: "src/handler.ts", status: "added" },
      { path: "src/new.ts", status: "modified" },
    ]);
  });
});
