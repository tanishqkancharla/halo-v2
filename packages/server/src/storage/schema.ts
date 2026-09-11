import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const haloExtensionPermissions = sqliteTable(
  "halo_extension_permissions",
  {
    extensionId: text("extension_id").notNull(),
    path: text("path").notNull(),
    status: text("status", { enum: ["granted", "pending"] }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.extensionId, table.path] })],
);

export const haloSchema = { haloExtensionPermissions };

export const haloSchemaSql = `
CREATE TABLE IF NOT EXISTS halo_extension_permissions (
  extension_id TEXT NOT NULL,
  path TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('granted', 'pending')),
  PRIMARY KEY (extension_id, path)
)
`;
