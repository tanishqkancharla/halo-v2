import { Button as MauiButton } from "maui";
import { describe, expect, test } from "vitest";
import { Link as WouterLink } from "wouter";
import { Type } from "@halo/plugin-sdk/schema";
import { ORPCError, os } from "@halo/plugin-sdk/server";
import { Button, Link } from "@halo/plugin-sdk/view";

describe("plugin-sdk", () => {
  test("view re-exports Maui Button and wouter Link", () => {
    expect(typeof Button).toBe("function");
    expect(Button).toBe(MauiButton);
    expect(Link).toBe(WouterLink);
  });

  test("schema re-exports Type.Literal", () => {
    expect(typeof Type.Literal).toBe("function");
  });

  test("server re-exports os and ORPCError", () => {
    expect(os).toBeDefined();
    expect(typeof ORPCError).toBe("function");
  });
});
