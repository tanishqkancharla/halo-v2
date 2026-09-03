import * as errore from "errore";

export class FlowstackServeError extends errore.createTaggedError({
  name: "FlowstackServeError",
  message: "flowstack server failed: $reason",
}) {}

export class FlowstackFileError extends errore.createTaggedError({
  name: "FlowstackFileError",
  message: "flowstack could not read $path: $reason",
}) {}

export class FlowstackMermaidError extends errore.createTaggedError({
  name: "FlowstackMermaidError",
  message: "flowstack could not render mermaid",
}) {}
