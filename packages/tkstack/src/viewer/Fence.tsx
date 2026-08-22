import { CodeBlock } from "maui";
import type { Fence as FenceModel } from "../parseFence.js";
import { CallStackDiff } from "./CallStackDiff.tsx";
import { CodeDiff } from "./CodeDiff.tsx";
import { FileExcerpt } from "./FileExcerpt.tsx";
import { HtmlBlock } from "./HtmlBlock.tsx";
import { MermaidBlock } from "./MermaidBlock.tsx";

export function Fence(props: { fence: FenceModel }) {
  const fence = props.fence;
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
