import "csstype";

declare module "csstype" {
  namespace Property {
    type CornerStyle =
      | Globals
      | "bevel"
      | "notch"
      | "round"
      | "scoop"
      | "square"
      | "squircle"
      | (string & {});
  }

  interface Properties<TLength = (string & {}) | 0, TTime = string & {}> {
    WebkitAppRegion?: "drag" | "no-drag";
    // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Chromium defines this CSS property name.
    cornerShape?: Property.CornerStyle | undefined;
  }
}
