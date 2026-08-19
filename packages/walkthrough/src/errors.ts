import * as errore from "errore";

export class WalkthroughServeError extends errore.createTaggedError({
  name: "WalkthroughServeError",
  message: "Walkthrough server failed: $reason",
}) {}

export class WalkthroughFileError extends errore.createTaggedError({
  name: "WalkthroughFileError",
  message: "Walkthrough could not read $path: $reason",
}) {}
