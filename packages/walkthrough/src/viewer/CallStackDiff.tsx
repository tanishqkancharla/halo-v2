import { colors, flex, monospace, radius, shadow, spacing, text } from "maui";
import { style, useStyles } from "purse-styles";

export function CallStackDiff(props: { source: string }) {
  const shell = useStyles(styles.shell);
  const header = useStyles(styles.header);
  const pre = useStyles(styles.pre);
  const add = useStyles(styles.add);
  const remove = useStyles(styles.remove);
  const context = useStyles(styles.context);

  return (
    <figure className={shell} data-walkthrough-kind="callstack">
      <figcaption className={header}>Call stack</figcaption>
      <pre className={pre}>
        {props.source.split("\n").map((line, index) => {
          if (line.startsWith("+")) {
            return (
              <span className={add} key={index}>
                {line}
                {"\n"}
              </span>
            );
          }
          if (line.startsWith("-")) {
            return (
              <span className={remove} key={index}>
                {line}
                {"\n"}
              </span>
            );
          }
          return (
            <span className={context} key={index}>
              {line}
              {"\n"}
            </span>
          );
        })}
      </pre>
    </figure>
  );
}

const styles = {
  shell: style(flex({ direction: "column" }), radius.md, shadow.subtle, {
    overflow: "hidden",
    minWidth: 0,
  }),
  header: style(
    text("xs", 500, "lowContrast"),
    spacing.padding({ x: 4, y: 2 }),
    {
      letterSpacing: "0.02em",
    },
  ),
  pre: style(monospace, spacing.padding({ x: 4, y: 3 }), {
    margin: 0,
    overflowX: "auto",
    fontSize: 13,
    lineHeight: "20px",
    backgroundColor: colors.gray[2],
  }),
  add: style({
    display: "block",
    color: "light-dark(#116329, #7ee787)",
    backgroundColor: "light-dark(#dafbe1, #033a16)",
  }),
  remove: style({
    display: "block",
    color: "light-dark(#82071e, #ff9592)",
    backgroundColor: "light-dark(#ffebe9, #3b1219)",
  }),
  context: style({
    display: "block",
  }),
};
