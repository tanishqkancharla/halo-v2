import { createElement, type ReactNode } from "react";
import { colors, monospace, radius, spacing } from "maui";
import { style, useStyles } from "purse-styles";
import type {
  ViewerDocument,
  ViewerElement,
  ViewerNode,
} from "../parseViewer.js";
import { Fence } from "./Fence.tsx";

const voidTags = new Set(["img", "hr", "br"]);

export function ComarkView(props: { document: ViewerDocument }) {
  return (
    <>{props.document.nodes.map((node, index) => renderNode(node, index))}</>
  );
}

function renderNode(node: ViewerNode, key: number): ReactNode {
  if (node.type === "text") return node.value;
  if (node.type === "html") {
    if (node.block) {
      return (
        <div key={key} dangerouslySetInnerHTML={{ __html: node.source }} />
      );
    }
    return <span key={key} dangerouslySetInnerHTML={{ __html: node.source }} />;
  }
  if (node.type === "view") {
    return <Fence key={key} fence={node.fence} />;
  }
  return renderElement(node, key);
}

function renderElement(node: ViewerElement, key: number): ReactNode {
  const children = node.children.map((child, index) =>
    renderNode(child, index),
  );
  if (node.tag === "alert") {
    return (
      <blockquote key={key} data-alert={node.attrs.alertType}>
        {children}
      </blockquote>
    );
  }
  if (node.tag === "li" && node.attrs.task === true) {
    return (
      <li key={key} id={node.attrs.id} className={node.attrs.className}>
        <input
          type="checkbox"
          disabled
          defaultChecked={node.attrs.checked === true}
        />
        {children}
      </li>
    );
  }
  if (node.tag === "code") {
    return <InlineChip key={key}>{children}</InlineChip>;
  }
  if (voidTags.has(node.tag)) {
    return createElement(node.tag, { key, ...domAttrs(node) });
  }
  return createElement(node.tag, { key, ...domAttrs(node) }, children);
}

function domAttrs(node: ViewerElement) {
  return {
    id: node.attrs.id,
    href: node.attrs.href,
    src: node.attrs.src,
    alt: node.attrs.alt,
    title: node.attrs.title,
    className: node.attrs.className,
    start: node.attrs.start,
  };
}

function InlineChip(props: { children?: ReactNode }) {
  const className = useStyles(inlineCodeClass);
  return <code className={className}>{props.children}</code>;
}

const inlineCodeClass = style(
  monospace,
  radius.md,
  spacing.padding({ x: 2, y: 1 }),
  {
    backgroundColor: colors.gray[4],
  },
);
