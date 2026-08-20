import { isValidElement, type ReactElement, type ReactNode } from "react";
import { CodeBlock } from "maui";
import { parseFence } from "../parseFence.js";
import { CallStackDiff } from "./CallStackDiff.tsx";
import { CodeDiff } from "./CodeDiff.tsx";
import { FileExcerpt } from "./FileExcerpt.tsx";
import { HtmlBlock } from "./HtmlBlock.tsx";
import { MermaidBlock } from "./MermaidBlock.tsx";

type CodeProps = {
  className?: string;
  children?: ReactNode;
};

export function Fence(props: { children?: ReactNode }) {
  const code = findCodeElement(props.children);
  const lang =
    code === undefined
      ? "text"
      : (code.props.className ?? "language-text").replace(/^language-/, "");
  const source =
    code === undefined
      ? extractText(props.children)
      : extractText(code.props.children);
  const fence = parseFence(lang, source);

  if (fence.kind === "mermaid") return <MermaidBlock source={fence.source} />;
  if (fence.kind === "html") return <HtmlBlock source={fence.source} />;
  if (fence.kind === "callstack")
    return <CallStackDiff source={fence.source} />;
  if (fence.kind === "diff") {
    return <CodeDiff source={fence.source} path={fence.path} />;
  }
  if (fence.kind === "file") {
    return (
      <FileExcerpt
        path={fence.path}
        start={fence.start}
        end={fence.end}
        fallback={fence.source}
      />
    );
  }
  return <CodeBlock lang={fence.lang}>{fence.source}</CodeBlock>;
}

function findCodeElement(node: ReactNode): ReactElement<CodeProps> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findCodeElement(child);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isValidElement(node)) return undefined;
  if (isFencedCode(node)) return node;
  return findCodeElement(elementChildren(node));
}

function isFencedCode(node: ReactElement): node is ReactElement<CodeProps> {
  // SAFETY: MDX puts language-* on the fenced code component's props.
  const props = node.props as { className?: string; children?: ReactNode };
  return (
    props.className !== undefined && props.className.startsWith("language-")
  );
}

function extractText(node: ReactNode): string {
  if (node === undefined || node === null) return "";
  if (node === true || node === false) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) return extractText(elementChildren(node));
  return String(node);
}

function elementChildren(node: ReactElement): ReactNode {
  // SAFETY: MDX pre/code elements pass React children on props.
  const props = node.props as { children?: ReactNode };
  return props.children;
}
