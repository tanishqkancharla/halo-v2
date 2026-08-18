/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MauiProvider } from "maui";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { describe, expect, test } from "vitest";
import { MainPane } from "./MainPane.tsx";

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
