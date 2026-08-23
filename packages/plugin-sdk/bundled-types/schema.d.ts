export class SchemaParseError extends Error {
  readonly document: string;
  readonly detail: string;
}

export function parseVersioned(args: {
  name: string;
  schema: unknown;
  value: unknown;
}): SchemaParseError | unknown;

export const Type: unknown;

export type Static<T> = T;
