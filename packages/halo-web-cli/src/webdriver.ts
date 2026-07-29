import { remote } from "webdriverio";

const hostname = "127.0.0.1";
const port = 4445;
const statusUrl = `http://${hostname}:${port}/status`;

type ConnectedBrowser = Awaited<ReturnType<typeof remote>>;
type BrowserScript = (browser: ConnectedBrowser) => Promise<unknown>;
type AsyncFunctionConstructor = new (
  argumentName: string,
  source: string,
) => BrowserScript;

type StatusResponse = {
  value: {
    ready: boolean;
    message: string;
  };
};

const AsyncFunction = Object.getPrototypeOf(async function () {})
  .constructor as AsyncFunctionConstructor;

export async function getStatus(): Promise<StatusResponse["value"]> {
  const response = await fetch(statusUrl);
  const status = (await response.json()) as StatusResponse;
  return status.value;
}

export async function execute(source: string): Promise<unknown> {
  const browser = await remote({
    hostname,
    port,
    logLevel: "silent",
    capabilities: {},
  });
  try {
    const script = new AsyncFunction("browser", source);
    return await script(browser);
  } finally {
    await browser.deleteSession();
  }
}
