import { os as baseOs } from "@orpc/server";
import type { ExtensionContext } from "./tools.js";
export { type } from "@orpc/server";
export { Type } from "@sinclair/typebox";
export type {
  ExtensionContext,
  ExtensionTools,
  ExtensionToolResult,
} from "./tools.js";
export const os = baseOs.$context<ExtensionContext>();
