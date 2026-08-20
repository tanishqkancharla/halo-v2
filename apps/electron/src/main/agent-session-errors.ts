import * as errore from "errore";

export class EmptyPromptError extends errore.createTaggedError({
  name: "EmptyPromptError",
  message: "Enter a prompt first.",
}) {}

export class PromptFailedError extends errore.createTaggedError({
  name: "PromptFailedError",
  message: "$reason",
}) {}
