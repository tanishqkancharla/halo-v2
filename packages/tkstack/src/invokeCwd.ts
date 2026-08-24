import path from "node:path";

function invokeWorkingDirectory() {
  if (process.env.INIT_CWD === undefined) return process.cwd();
  return process.env.INIT_CWD;
}

export function resolveFromInvokeCwd(filePath: string) {
  return path.resolve(invokeWorkingDirectory(), filePath);
}
