import * as errore from "errore";
import { parseAST } from "md4x/napi";
import type { ComarkElement, ComarkNode } from "md4x/napi";
import { TkstackParseError } from "./errors.js";
import { parseFence, type Fence } from "./parseFence.js";

export type ViewerDocument = {
  nodes: ViewerNode[];
};

export type ViewerNode = ViewerText | ViewerElement | ViewerHtml | ViewerView;

export type ViewerText = {
  type: "text";
  value: string;
};

export type ViewerElement = {
  type: "element";
  tag: string;
  attrs: ViewerElementAttrs;
  children: ViewerNode[];
};

export type ViewerHtml = {
  type: "html";
  block: boolean;
  source: string;
};

export type ViewerView = {
  type: "view";
  fence: Fence;
};

export type ViewerElementAttrs = {
  id: string | undefined;
  href: string | undefined;
  src: string | undefined;
  alt: string | undefined;
  title: string | undefined;
  className: string | undefined;
  start: number | undefined;
  checked: boolean | undefined;
  task: boolean | undefined;
  alertType: string | undefined;
};

export function parseViewerDocument(source: string) {
  const tree = errore.try({
    try: () => parseAST(source),
    catch: (cause) => new TkstackParseError({ cause }),
  });
  if (tree instanceof Error) return tree;
  return {
    nodes: tree.nodes.flatMap(fromNode),
  };
}

function fromNode(node: ComarkNode): ViewerNode[] {
  if (!Array.isArray(node)) {
    return [{ type: "text", value: node }];
  }
  const converted = fromElement(node);
  if (converted === undefined) return [];
  if (Array.isArray(converted)) return converted;
  return [converted];
}

function fromElement(
  element: ComarkElement,
): ViewerNode | ViewerNode[] | undefined {
  const [tag, , ...children] = element;
  if (tag === null) return undefined;
  if (tag === "template") return children.flatMap(fromNode);
  if (tag === "pre") {
    return fenceView(stringAttr(element, "language"), comarkText(children));
  }
  if (tag === "mermaid") return fenceView("mermaid", comarkText(children));
  if (tag === "callstack") return fenceView("callstack", comarkText(children));
  if (tag === "diff") {
    const path = stringAttr(element, "path");
    const lang = path === undefined ? "diff" : `diff:${path}`;
    return fenceView(lang, comarkText(children));
  }
  if (tag === "file") return fileView(element, children);
  if (tag === "html") return htmlView(element, children);
  return {
    type: "element",
    tag,
    attrs: elementAttrs(element),
    children: children.flatMap(fromNode),
  };
}

function fenceView(lang: string | undefined, source: string): ViewerView {
  return {
    type: "view",
    fence: parseFence(lang === undefined ? "" : lang, source),
  };
}

function fileView(
  element: ComarkElement,
  children: ComarkNode[],
): ViewerView | ViewerNode[] {
  const path = stringAttr(element, "path");
  if (path === undefined) return children.flatMap(fromNode);
  const start = lineAttr(element, "start");
  const end = lineAttr(element, "end");
  // MDC ::file with no range loads the whole file.
  return fenceView(
    `${start === undefined ? 1 : start}:${end === undefined ? Number.MAX_SAFE_INTEGER : end}:${path}`,
    comarkText(children),
  );
}

function htmlView(
  element: ComarkElement,
  children: ComarkNode[],
): ViewerHtml | ViewerView {
  const source = comarkText(children);
  if (children.every((child) => !Array.isArray(child))) {
    return {
      type: "html",
      block: element[1].block === true,
      source,
    };
  }
  return {
    type: "view",
    fence: parseFence("html", source),
  };
}

function elementAttrs(element: ComarkElement): ViewerElementAttrs {
  const checked = element[1].checked;
  return {
    id: stringAttr(element, "id"),
    href: stringAttr(element, "href"),
    src: stringAttr(element, "src"),
    alt: stringAttr(element, "alt"),
    title: stringAttr(element, "title"),
    className: stringAttr(element, "class"),
    start: lineAttr(element, "start"),
    checked: checked === true ? true : checked === false ? false : undefined,
    task: element[1].task === true ? true : undefined,
    alertType: stringAttr(element, "type"),
  };
}

function stringAttr(element: ComarkElement, key: string) {
  const value = element[1][key];
  if (value === undefined) return undefined;
  // SAFETY: md4x string attributes are JSON strings.
  return value as string;
}

function lineAttr(element: ComarkElement, key: string) {
  const value = stringAttr(element, key);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return undefined;
  return parsed;
}

function comarkText(nodes: ComarkNode[]): string {
  return nodes
    .map((node) => {
      if (!Array.isArray(node)) return node;
      const [, , ...children] = node;
      return comarkText(children);
    })
    .join("");
}
