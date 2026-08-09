import { useEffect, useState } from "react";
import { colors, motion } from "maui";
import { style, useStyles } from "purse-styles";
import { Loader } from "./patterns/Loader.tsx";

const SHOW_INDICATOR_AFTER_MS = 2000;

export function LoadingPage() {
  const [showIndicator, setShowIndicator] = useState(false);
  const shell = useStyles(styles.shell);
  const indicator = useStyles(
    styles.indicator,
    motion.standard("opacity"),
    showIndicator ? styles.indicatorVisible : undefined,
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowIndicator(true);
    }, SHOW_INDICATOR_AFTER_MS);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <main className={shell}>
      <div className={indicator}>
        <Loader size="1.5rem" variant="muted" />
      </div>
    </main>
  );
}

const styles = {
  shell: style({
    display: "grid",
    placeItems: "center",
    height: "100%",
    backgroundColor: colors.gray[2],
  }),
  indicator: style({
    opacity: 0,
  }),
  indicatorVisible: style({
    opacity: 1,
  }),
};
