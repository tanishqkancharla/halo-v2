/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MauiProvider } from "maui";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { describe, expect, test } from "vitest";
import { MainPane } from "./MainPane.tsx";

// React reads this off the jsdom window, not Node's globalThis.
Object.assign(window, { IS_REACT_ACT_ENVIRONMENT: true });

window.matchMedia = (query) => ({
  matches: false,
  media: query,
  // MediaQueryList.onchange is null in the DOM when unset.
  // oxlint-disable-next-line unicorn/no-null
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {
    return false;
  },
});

window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("MainPane", () => {
  test("renders the UI kit at /uikit", async () => {
    const { hook } = memoryLocation({ path: "/uikit", static: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(() => {
      root.render(
        <MauiProvider>
          <Router hook={hook}>
            <MainPane sessions={[]} />
          </Router>
        </MauiProvider>,
      );
    });

    expect(container.querySelector('[aria-label="UI kit"]')).not.toBeNull();

    await act(() => {
      root.unmount();
    });
    container.remove();
  });
});
