import { describe, expect, test } from "vitest";
import { extractFences, extractTitle } from "./extractWalkthrough.js";

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
`;

describe("extractWalkthrough", () => {
  test("reads the title and every fence", () => {
    expect(extractTitle(sample)).toBe("Input validation");
    const fences = extractFences(sample);
    expect(fences.map((fence) => fence.kind)).toEqual([
      "mermaid",
      "file",
      "diff",
    ]);
  });
});
