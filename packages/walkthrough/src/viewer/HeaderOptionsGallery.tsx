import type { ReactNode } from "react";
import {
  Badge,
  Button,
  Icons,
  backgroundColor,
  colors,
  flex,
  flexItem,
  icon,
  radius,
  shadow,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import { Check } from "./Check.tsx";
import { DoneButton } from "./DoneButton.tsx";

const sampleTitle = "Walkthrough fixture";

export function HeaderOptionsGallery() {
  const page = useStyles(styles.page);
  const intro = useStyles(styles.intro);
  const heading = useStyles(styles.heading);
  const lede = useStyles(styles.lede);
  const list = useStyles(styles.list);
  return (
    <div className={page}>
      <div className={intro}>
        <div className={heading}>Header options</div>
        <p className={lede}>
          The live walkthrough uses option 1. Drop <code>?gallery=headers</code>{" "}
          from the URL to open it.
        </p>
      </div>
      <div className={list}>
        <Option
          n="1"
          title="Done with check"
          note="Default button. Clear stop. This is what the page uses."
          current
        >
          <ChromeBar title={sampleTitle} action={<DoneButton />} />
        </Option>
        <Option
          n="2"
          title="Quiet Done with check"
          note="Same words, no fill. Quieter next to the title."
        >
          <ChromeBar
            title={sampleTitle}
            action={<DoneButton variant="quiet" />}
          />
        </Option>
        <Option
          n="3"
          title="Done, text only"
          note="The word without the check."
        >
          <ChromeBar title={sampleTitle} action={<Button>Done</Button>} />
        </Option>
        <Option
          n="4"
          title="Check only"
          note="Icon with an accessible name. Compact, less clear."
        >
          <ChromeBar title={sampleTitle} action={<CheckOnly />} />
        </Option>
        <Option
          n="5"
          title="Quiet X"
          note="The previous control. Icon only, no word."
        >
          <ChromeBar title={sampleTitle} action={<QuietX />} />
        </Option>
        <Option
          n="6"
          title="No chrome title"
          note="Done sits alone. The MDX heading is the page title."
        >
          <ChromeBar action={<DoneButton />} />
        </Option>
        <Option
          n="7"
          title="Footer Done"
          note="Title stays up top. Done sits in a bottom bar."
        >
          <FooterChrome />
        </Option>
      </div>
    </div>
  );
}

function Option(props: {
  n: string;
  title: string;
  note: string;
  current?: boolean;
  children: ReactNode;
}) {
  const block = useStyles(styles.option);
  const cap = useStyles(styles.caption);
  const name = useStyles(styles.optionTitle);
  const note = useStyles(styles.note);
  const frame = useStyles(styles.frame);
  return (
    <section className={block}>
      <div className={cap}>
        <div className={name}>
          {props.n}. {props.title}
          {props.current === true ? <Badge>In use</Badge> : undefined}
        </div>
        <div className={note}>{props.note}</div>
      </div>
      <div className={frame}>{props.children}</div>
    </section>
  );
}

function ChromeBar(props: { title?: string; action?: ReactNode }) {
  const header = useStyles(styles.header);
  const titleClass = useStyles(styles.title);
  const title =
    props.title === undefined ? (
      <div className={titleClass} />
    ) : (
      <div className={titleClass}>{props.title}</div>
    );
  return (
    <header className={header}>
      {title}
      {props.action}
    </header>
  );
}

function FooterChrome() {
  const shell = useStyles(styles.footerShell);
  const body = useStyles(styles.footerBody);
  const footer = useStyles(styles.footer);
  return (
    <div className={shell}>
      <ChromeBar title={sampleTitle} />
      <div className={body}>MDX content</div>
      <footer className={footer}>
        <DoneButton />
      </footer>
    </div>
  );
}

function CheckOnly() {
  const checkClass = useStyles(icon("sm"));
  return (
    <Button aria-label="Done">
      <Check className={checkClass} />
    </Button>
  );
}

function QuietX() {
  const closeIcon = useStyles(icon("sm"));
  return (
    <Button variant="quiet" aria-label="Close">
      <Icons.CircleX className={closeIcon} />
    </Button>
  );
}

const styles = {
  page: style(
    flex({ direction: "column", gap: 8 }),
    spacing.padding({ all: 12 }),
    {
      minHeight: "100vh",
      backgroundColor: colors.gray[4],
    },
  ),
  intro: style(flex({ direction: "column", gap: 2 })),
  heading: style(text("lg", 600, "highContrast")),
  lede: style(text("sm", 400, "lowContrast"), {
    margin: 0,
  }),
  list: style(flex({ direction: "column", gap: 8 })),
  option: style(flex({ direction: "column", gap: 3 })),
  caption: style(flex({ direction: "column", gap: 1 })),
  optionTitle: style(
    flex({ direction: "row", align: "center", gap: 3 }),
    text("sm", 600, "highContrast"),
  ),
  note: style(text("xs", 400, "lowContrast")),
  frame: style(radius.md, shadow.subtle, {
    overflow: "hidden",
    backgroundColor: backgroundColor.app,
  }),
  header: style(
    flex({ direction: "row", align: "center", justify: "between" }),
    spacing.padding({ x: 6, y: 3 }),
    {
      minWidth: 0,
      backgroundColor: backgroundColor.app,
    },
  ),
  title: style(text("md", 600, "highContrast"), {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  footerShell: style(flex({ direction: "column" })),
  footerBody: style(
    text("sm", 400, "lowContrast"),
    spacing.padding({ x: 6, y: 8 }),
    {
      color: colors.gray[9],
    },
  ),
  footer: style(
    flex({ direction: "row", align: "center", justify: "end" }),
    spacing.padding({ x: 6, y: 3 }),
    flexItem({ size: "hug" }),
    {
      backgroundColor: backgroundColor.app,
    },
  ),
};
