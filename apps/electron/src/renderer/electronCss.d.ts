import "csstype";

declare module "csstype" {
  namespace Property {
    type CornerShape =
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
    cornerShape?: Property.CornerShape | undefined;
  }
}
