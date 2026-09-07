import { useState } from "react";
import { colors, flex, spacing, text } from "maui";
import { style, useStyles } from "purse-styles";
import type { Step, Story } from "../model/Story.js";
import { ProcessBadge } from "./badges.tsx";
import { SourceExcerpt } from "./SourceExcerpt.tsx";

/**
 * A flow told as a few sentences. Each sentence opens into the sentences
 * inside it, and a sentence with code shows that code when open.
 */
export function StoryView(props: { story: Story }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const list = useStyles(styles.list);
  return (
    <ol className={list}>
      {props.story.steps.map((entry, index) => (
        <StepItem
          key={index}
          step={entry}
          label={`${index + 1}`}
          depth={0}
          open={open}
          toggle={toggle}
        />
      ))}
    </ol>
  );
}

function StepItem(props: {
  step: Step;
  label: string;
  depth: number;
  open: Set<string>;
  toggle: (key: string) => void;
}) {
  const { step: node, label } = props;
  const canOpen = node.steps.length > 0 || node.source !== undefined;
  const isOpen = props.open.has(label);
  const item = useStyles(styles.item);
  const row = useStyles(styles.row, props.depth === 0 && styles.rowTop);
  const marker = useStyles(styles.marker);
  const sentence = useStyles(
    props.depth === 0 ? styles.sentenceTop : styles.sentence,
  );
  const when = useStyles(styles.when);
  const meta = useStyles(styles.meta);
  const excerpt = useStyles(styles.excerpt);
  const list = useStyles(styles.list);
  return (
    <li className={item}>
      <button
        type="button"
        className={row}
        disabled={!canOpen}
        aria-expanded={canOpen ? isOpen : undefined}
        onClick={() => props.toggle(label)}
      >
        <span className={marker} aria-hidden="true">
          {canOpen ? (isOpen ? "▼" : "▶") : "·"}
        </span>
        <span className={sentence}>
          {node.text}
          {node.when === undefined ? undefined : (
            <span className={when}> — {node.when}</span>
          )}
        </span>
        <span className={meta}>
          {node.process === undefined ? undefined : (
            <ProcessBadge process={node.process} />
          )}
        </span>
      </button>
      {isOpen && node.source !== undefined ? (
        <div className={excerpt}>
          <SourceExcerpt source={node.source} marks={[]} />
        </div>
      ) : undefined}
      {isOpen && node.steps.length > 0 ? (
        <ol className={list}>
          {node.steps.map((child, index) => (
            <StepItem
              key={index}
              step={child}
              label={`${label}.${index + 1}`}
              depth={props.depth + 1}
              open={props.open}
              toggle={props.toggle}
            />
          ))}
        </ol>
      ) : undefined}
    </li>
  );
}

const styles = {
  list: style({
    listStyle: "none",
    margin: 0,
    padding: 0,
    paddingLeft: spacing.value(6),
  }),
  item: style({
    margin: 0,
    padding: 0,
  }),
  row: style(spacing.padding({ y: 2, x: 3 }), {
    display: "flex",
    alignItems: "baseline",
    gap: spacing.value(3),
    width: "100%",
    border: 0,
    borderRadius: "6px",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
    "&:hover:not(:disabled)": {
      backgroundColor: colors.gray[3],
    },
    "&:disabled": {
      cursor: "default",
    },
  }),
  rowTop: style(spacing.padding({ y: 3, x: 3 })),
  marker: style({
    flex: "0 0 auto",
    width: "1.5ch",
    fontSize: "10px",
    color: colors.gray[9],
    textAlign: "center",
  }),
  sentenceTop: style(
    text({ size: "md", fontWeight: 500, color: "highContrast" }),
    {
      flex: "1 1 auto",
      minWidth: 0,
      lineHeight: 1.5,
    },
  ),
  sentence: style(
    text({ size: "sm", fontWeight: 400, color: "highContrast" }),
    {
      flex: "1 1 auto",
      minWidth: 0,
      lineHeight: 1.55,
    },
  ),
  when: style(text({ size: "xs", fontWeight: 400, color: "lowContrast" })),
  meta: style(flex({ direction: "row", align: "center", gap: 2 }), {
    flex: "0 0 auto",
    alignSelf: "center",
  }),
  excerpt: style(spacing.padding({ y: 3 }), {
    marginLeft: `calc(1.5ch + ${spacing.value(6)})`,
    marginRight: spacing.value(3),
  }),
};
