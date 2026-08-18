// Packages left as require() in main (native addons, etc.). Forge Vite only
// packs `/.vite`, so packaging must copy these and their runtime closure.
export const mainProcessExternals = ["@parcel/watcher", "esbuild"] as const;

/** Vite/Rolldown external entries for the main process build. */
export function viteMainExternals(): Array<string | RegExp> {
  return [
    ...mainProcessExternals,
    // @parcel/watcher loads `@parcel/watcher-<platform>-<arch>` at runtime.
    /^@parcel\/watcher-/,
  ];
}
