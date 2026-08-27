import * as errore from "errore";

export class TkstackServeError extends errore.createTaggedError({
  name: "TkstackServeError",
  message: "tkstack server failed: $reason",
}) {}

export class TkstackFileError extends errore.createTaggedError({
  name: "TkstackFileError",
  message: "tkstack could not read $path: $reason",
}) {}

export class TkstackRegistryError extends errore.createTaggedError({
  name: "TkstackRegistryError",
  message: "tkstack registry failed: $reason",
}) {}

export class TkstackMermaidError extends errore.createTaggedError({
  name: "TkstackMermaidError",
  message: "tkstack could not render mermaid",
}) {}

export class TkstackParseError extends errore.createTaggedError({
  name: "TkstackParseError",
  message: "tkstack could not parse markdown",
}) {}
