import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

const disableDirective = /(?:oxlint|eslint)-disable(?:-next-line|-line)?\b(?<rules>.*?)(?:\s--(?<reason>.*))?$/u;

function disablesFloatingPromiseRule(comment: ESTree.Comment): boolean {
  const match = disableDirective.exec(comment.value.trim());
  if (match === null) return false;

  const rules = match.groups?.rules?.trim();
  return rules === "" || rules?.split(/[,\s]+/u).includes("typescript/no-floating-promises") === true;
}

function hasReason(comment: ESTree.Comment): boolean {
  const reason = disableDirective.exec(comment.value.trim())?.groups?.reason;
  return reason !== undefined && reason.trim() !== "";
}

/** Require intentional floating Promises to explain why awaiting them would be wrong. */
export const requireReasonForFloatingPromiseDisableRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Require a reason on directives that disable no-floating-promises.",
    },
    messages: {
      missingReason:
        "Explain why this Promise must not be awaited after `--` in the disable directive.",
    },
  },
  createOnce(context) {
    return {
      Program(node) {
        for (const comment of node.comments) {
          if (!disablesFloatingPromiseRule(comment) || hasReason(comment)) continue;
          context.report({ node: comment, messageId: "missingReason" });
        }
      },
    };
  },
});
