import { createBrowserToolsForPage } from "libretto-browser-tools";
import type { Page } from "playwright";
import * as errore from "errore";

export class BrowserError extends errore.createTaggedError({
  name: "BrowserError",
  message: "Browser operation failed: $detail",
}) {}

export class BrowserPage {
  private readonly toolkit;
  private readonly errors: string[] = [];
  private readonly onPageError = (error: Error) => {
    this.errors.push(error.message);
  };

  constructor(readonly page: Page) {
    page.setDefaultTimeout(10_000);
    this.toolkit = createBrowserToolsForPage(page);
    page.on("pageerror", this.onPageError);
  }

  async exec(source: string) {
    const result = await this.toolkit.tools.browser_exec.execute({
      sessionId: this.toolkit.sessionId,
      code: source,
    });
    if (!result.ok) return new BrowserError({ detail: result.error });
    return {
      result: result.result,
      stdout: result.stdout,
      stderr: result.stderr,
      snapshotDiff: result.snapshotDiff,
      errors: this.errors.splice(0),
    };
  }

  async snapshot() {
    const result = await this.toolkit.tools.browser_snapshot.execute({
      sessionId: this.toolkit.sessionId,
    });
    if (!result.ok) return new BrowserError({ detail: result.error });
    const title = await this.page
      .title()
      .catch((cause) => new BrowserError({ detail: "read page title", cause }));
    if (title instanceof Error) return title;
    return {
      url: this.page.url(),
      title,
      tree: result.tree,
      errors: this.errors.splice(0),
    };
  }

  async screenshot(path: string) {
    const result = await this.page
      .screenshot({ path })
      .catch((cause) => new BrowserError({ detail: "save screenshot", cause }));
    if (result instanceof Error) return result;
    return { path };
  }

  async dispose() {
    this.page.off("pageerror", this.onPageError);
    await this.toolkit.dispose();
  }
}
