export function collection(fields: Record<string, unknown>): unknown;
export function defineSchema(collections: Record<string, unknown>): unknown;
export function defineRelations(relations: Record<string, unknown>): unknown;

export const t: {
  id: () => unknown;
  string: () => unknown;
  number: () => unknown;
  boolean: () => unknown;
};
