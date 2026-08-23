export namespace JSX {
  interface Element {
    readonly __haloJsx?: true;
  }
  interface IntrinsicElements {
    [elemName: string]: unknown;
  }
  interface ElementChildrenAttribute {
    children: unknown;
  }
}

export function jsx(type: unknown, props: unknown, key?: unknown): unknown;
export function jsxs(type: unknown, props: unknown, key?: unknown): unknown;
export function jsxDEV(type: unknown, props: unknown, key?: unknown): unknown;
export const Fragment: unknown;
