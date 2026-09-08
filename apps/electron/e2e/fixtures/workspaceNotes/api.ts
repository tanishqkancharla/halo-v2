import { os, type ExtensionToolResult } from "@get-halo/extension-sdk/api";

const api = os.$context<{
  tools: {
    files: {
      read(input: {
        path: string;
      }): Promise<ExtensionToolResult<{ path: string; text: string }>>;
    };
  };
}>();

// oxlint-disable-next-line anti-slop/no-unused-exports -- The extension builder imports this entry from the scaffolded test package.
export default {
  notes: api.handler(async ({ context }) => {
    const result = await context.tools.files.read({ path: "notes.txt" });
    if (!result.ok) throw new Error(result.error.message);
    return result.data.text;
  }),
};
