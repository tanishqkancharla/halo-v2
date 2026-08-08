import type React from "react";
import { useEffect } from "react";
import { Markdown } from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  backgroundColor,
  colors,
  flex,
  focusRing,
  proseHtml,
  proseMaxWidth,
  radius,
  shadow,
  shadowVars,
  spacing,
  text,
  type ProseSize,
} from "maui";
import { style, useStyles } from "purse-styles";
import { useRefCurrent } from "./useRefCurrent.ts";

type EditorProps = {
  /** Initial markdown content. Updates are applied when this value changes. */
  content?: string;
  /** Called with the current markdown whenever the document changes. */
  onChange?: (markdown: string) => void;
  placeholder?: string;
  size?: ProseSize;
  editable?: boolean;
  className?: string;
  "aria-label"?: string;
  onSubmit?: () => void;
  /** Optional actions rendered inside the editor shell (e.g. Send). */
  actions?: React.ReactNode;
};

/**
 * TipTap markdown editor with CommonMark shortcuts (`#`, `**`, `-`, `>`, …)
 * and Maui prose type styles on the ProseMirror surface.
 */
export function Editor({
  content = "",
  onChange,
  placeholder = "Write a message…",
  size = "md",
  editable = true,
  className,
  "aria-label": ariaLabel = "Message editor",
  onSubmit,
  actions,
}: EditorProps) {
  const shellClassName = useStyles(editorShellClass);
  const actionsClassName = useStyles(editorActionsClass);
  const proseClassName = useStyles(proseHtml(size));
  const onChangeRef = useRefCurrent(onChange);
  const onSubmitRef = useRefCurrent(onSubmit);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        link: {
          openOnClick: false,
        },
      }),
      Markdown,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    contentType: "markdown",
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        class: `maui-editor-prose ${proseClassName}`,
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          onSubmitRef.current?.();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      onChangeRef.current?.(current.getMarkdown());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: {
          ...editor.options.editorProps?.attributes,
          "aria-label": ariaLabel,
          class: `maui-editor-prose ${proseClassName}`,
        },
      },
    });
  }, [editor, ariaLabel, proseClassName]);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getMarkdown();
    if (content === current) return;
    editor.commands.setContent(content, { contentType: "markdown" });
  }, [editor, content]);

  return (
    <div className={joinClassNames(shellClassName, className)}>
      <EditorContent editor={editor} />
      {actions ? <div className={actionsClassName}>{actions}</div> : null}
    </div>
  );
}

const editorShellClass = style(
  radius.lg,
  shadow.subtle,
  spacing.padding({ x: 4, y: 3 }),
  focusRing("&:focus-within", shadowVars.subtle),
  flex({ direction: "column", gap: 2 }),
  {
    backgroundColor: backgroundColor.element,
    maxWidth: proseMaxWidth,
    minWidth: 0,
    "& .ProseMirror": {
      outline: "none",
      minHeight: "2.75em",
    },
    "& .ProseMirror p.is-editor-empty:first-child::before": {
      color: colors.gray[9],
      content: "attr(data-placeholder)",
      float: "left",
      height: 0,
      pointerEvents: "none",
    },
  },
);

const editorActionsClass = style(
  flex({ align: "center", justify: "end", gap: 3 }),
);

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}
