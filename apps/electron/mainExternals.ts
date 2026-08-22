// Packages left as require() in main (native addons, etc.). Forge Vite only
// packs `/.vite`, so packaging must copy these and their runtime closure.
export const mainProcessExternals = [
  "@parcel/watcher",
  "esbuild",
  "jiti",
] as const;

// jiti loads plugin servers from disk. Those files import this package, so
// require.resolve must work in the asar. Keep it out of viteMainExternals:
// the host still bundles the TypeScript sources into main.cjs.
export const mainProcessDiskPackages = ["@halo/plugin-sdk"] as const;

// schema.ts and server.ts imports. Skip view-only deps (maui, wouter, react).
export const pluginSdkJitiDependencies = [
  "@sinclair/typebox",
  "@orpc/server",
  "errore",
] as const;

/** Vite/Rolldown external entries for the main process build. */
export function viteMainExternals(): Array<string | RegExp> {
  return [
    ...mainProcessExternals,
    // @parcel/watcher loads `@parcel/watcher-<platform>-<arch>` at runtime.
    /^@parcel\/watcher-/,
  ];
}
