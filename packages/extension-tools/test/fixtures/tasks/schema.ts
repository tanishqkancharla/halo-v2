import { collection, defineSchema, t } from "@get-halo/extension-sdk/schema";

export default defineSchema({
  tasks: collection({ id: t.id(), label: t.string(), done: t.boolean() }),
});
