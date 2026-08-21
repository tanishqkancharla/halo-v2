import { describe, expect, test } from "vitest";
import { updateReadyButtonLayout } from "./updateReadyButtons.ts";

describe("updateReadyButtonLayout", () => {
  test("puts Update on the right as the default on macOS", () => {
    const layout = updateReadyButtonLayout("darwin");
    expect(layout.buttons[layout.updateIndex]).toBe("Update");
    expect(layout.buttons[layout.laterIndex]).toBe("Later");
    expect(layout.updateIndex).toBe(0);
    expect(layout.laterIndex).toBe(1);
  });

  test("puts Update on the right as the default on Windows", () => {
    const layout = updateReadyButtonLayout("win32");
    expect(layout.buttons[layout.updateIndex]).toBe("Update");
    expect(layout.buttons[layout.laterIndex]).toBe("Later");
    expect(layout.buttons).toEqual(["Later", "Update"]);
    expect(layout.updateIndex).toBe(1);
    expect(layout.laterIndex).toBe(0);
  });
});
