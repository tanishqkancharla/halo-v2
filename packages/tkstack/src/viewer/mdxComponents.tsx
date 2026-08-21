import type { ReactNode } from "react";
import { colors, monospace, radius, spacing } from "maui";
import { style, useStyles } from "purse-styles";
import { Fence } from "./Fence.tsx";

export const viewerComponents = {
  pre: ({ children }: { children?: ReactNode }) => <Fence>{children}</Fence>,
  code: InlineCode,
};

function InlineCode(props: { className?: string; children?: ReactNode }) {
  if (
    props.className !== undefined &&
    props.className.startsWith("language-")
  ) {
    return <code {...props} />;
  }
  return <InlineChip>{props.children}</InlineChip>;
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
