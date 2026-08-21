import * as errore from "errore";

export class TkstackServeError extends errore.createTaggedError({
  name: "TkstackServeError",
  message: "tkstack server failed: $reason",
}) {}

export class TkstackFileError extends errore.createTaggedError({
  name: "TkstackFileError",
  message: "tkstack could not read $path: $reason",
}) {}

export class TkstackMermaidError extends errore.createTaggedError({
  name: "TkstackMermaidError",
  message: "tkstack could not render mermaid",
}) {}
