import path from "node:path";
import * as errore from "errore";

export class UnsupportedE2EPlatformError extends errore.createTaggedError({
  name: "UnsupportedE2EPlatformError",
  message: "Halo e2e tests do not support $platform",
}) {}

export function resolveUnpackedExecutable() {
  const unpacked = path.resolve(
    import.meta.dirname,
    `../out/Halo-${process.platform}-${process.arch}`,
  );
  if (process.platform === "darwin") {
    return path.join(unpacked, "Halo.app", "Contents", "MacOS", "Halo");
  }
  if (process.platform === "linux") return path.join(unpacked, "Halo");
  if (process.platform === "win32") return path.join(unpacked, "Halo.exe");
  return new UnsupportedE2EPlatformError({ platform: process.platform });
}
