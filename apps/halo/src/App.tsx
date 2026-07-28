import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Badge,
  Button,
  Flex,
  H1,
  Icons,
  P,
  Spacer,
  backgroundColor,
  colors,
  motion,
  radius,
  shadow,
  spacing,
  text,
  useTheme,
} from "maui";
import { style, useStyles } from "purse-styles";

const appClass = style({
  minHeight: "100vh",
  backgroundColor: colors.gray[2],
});

const shellClass = style(spacing.padding({ x: 12, y: 16 }), {
  width: "min(100%, 720px)",
  minHeight: "100vh",
  marginInline: "auto",
});

const brandClass = style(text("sm", 600, "highContrast"), {
  letterSpacing: "-0.01em",
});

const cardClass = style(shadow.subtle, radius.lg, {
  marginTop: spacing.value(16),
  overflow: "hidden",
  backgroundColor: backgroundColor.element,
});

const heroClass = style(
  spacing.padding({ top: 16, right: 16, bottom: 12, left: 16 }),
);

const markClass = style(radius.md, {
  display: "grid",
  width: "44px",
  height: "44px",
  placeItems: "center",
  backgroundColor: colors.accent[9],
  color: "white",
  fontSize: "18px",
  fontWeight: 700,
  letterSpacing: "-0.04em",
});

const copyClass = style({
  maxWidth: "440px",
});

const lowContrastClass = style(text("sm", 400, "lowContrast"));

const dividerClass = style({
  height: "1px",
  backgroundColor: colors.gray[5],
});

const detailsClass = style(spacing.padding({ all: 16 }), {
  backgroundColor: colors.gray[2],
});

const detailRowClass = style({
  minHeight: "26px",
});

const detailLabelClass = style(text("xs", 500, "lowContrast"));
const detailValueClass = style(text("xs", 500, "highContrast"));

const statusDotClass = style(
  motion.standard("background-color"),
  radius.circle,
  {
    width: "7px",
    height: "7px",
    flex: "0 0 auto",
    backgroundColor: colors.accent[9],
  },
);

const footerClass = style(
  text("xs", 400, "lowContrast"),
  spacing.padding({ top: 12 }),
  {
    textAlign: "center",
  },
);

export function App() {
  const [message, setMessage] = useState("Ready when you are.");
  const [checking, setChecking] = useState(false);
  const { resolvedTheme, setPreference } = useTheme();

  const classes = {
    app: useStyles(appClass),
    shell: useStyles(shellClass),
    brand: useStyles(brandClass),
    card: useStyles(cardClass),
    hero: useStyles(heroClass),
    mark: useStyles(markClass),
    copy: useStyles(copyClass),
    lowContrast: useStyles(lowContrastClass),
    divider: useStyles(dividerClass),
    details: useStyles(detailsClass),
    detailRow: useStyles(detailRowClass),
    detailLabel: useStyles(detailLabelClass),
    detailValue: useStyles(detailValueClass),
    statusDot: useStyles(statusDotClass),
    footer: useStyles(footerClass),
  };

  async function checkHalo() {
    setChecking(true);
    try {
      setMessage(await invoke<string>("greet", { name: "Halo" }));
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className={classes.app}>
      <div className={classes.shell}>
        <Flex row alignItems="center" gap={4}>
          <div className={classes.brand}>Halo</div>
          <Badge>Desktop</Badge>
          <Spacer />
          <Button
            variant="quiet"
            aria-label={`Use ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
            onClick={() =>
              setPreference(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            {resolvedTheme === "dark" ? "Light" : "Dark"}
          </Button>
        </Flex>

        <section className={classes.card} aria-label="Halo status">
          <div className={classes.hero}>
            <Flex column gap={12}>
              <div className={classes.mark} aria-hidden="true">
                H
              </div>
              <Flex column gap={4}>
                <H1>Halo is ready</H1>
                <div className={classes.copy}>
                  <P>
                    A quiet workspace for Saffron Health. Your local app is set
                    up and waiting for its first workflow.
                  </P>
                </div>
              </Flex>
              <Flex row gap={6} alignItems="center">
                <Button onClick={checkHalo} disabled={checking}>
                  <Icons.Clock />
                  {checking ? "Checking…" : "Check connection"}
                </Button>
                <span className={classes.lowContrast} role="status">
                  {message}
                </span>
              </Flex>
            </Flex>
          </div>

          <div className={classes.divider} />

          <div className={classes.details}>
            <Flex column gap={4}>
              <div className={classes.detailRow}>
                <Flex row alignItems="center" gap={4}>
                  <span className={classes.statusDot} aria-hidden="true" />
                  <span className={classes.detailLabel}>App status</span>
                  <Spacer />
                  <span className={classes.detailValue}>Local and ready</span>
                </Flex>
              </div>
              <div className={classes.detailRow}>
                <Flex row alignItems="center" gap={4}>
                  <span className={classes.detailLabel}>Design system</span>
                  <Spacer />
                  <span className={classes.detailValue}>Maui</span>
                </Flex>
              </div>
            </Flex>
          </div>
        </section>

        <div className={classes.footer}>
          Saffron Health · Private by default
        </div>
      </div>
    </main>
  );
}
