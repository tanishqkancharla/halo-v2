import type { Key, ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { motionDurationMs } from "maui";
import { style, useStyles } from "purse-styles";

type CrossfadeDirection = "up" | "right" | "down" | "left";

export function Crossfade({
  children,
  contentKey,
  direction,
}: {
  children: ReactNode;
  contentKey: Key;
  direction: CrossfadeDirection;
}) {
  const container = useStyles(styles.container);
  const shouldReduceMotion = useReducedMotion();
  const transition =
    shouldReduceMotion === true
      ? { duration: 0 }
      : { duration: motionDurationMs / 1_000, ease: "easeInOut" as const };
  const animation: CrossfadeAnimation = {
    direction,
    distance: shouldReduceMotion === true ? 0 : 8,
  };

  return (
    <div className={container}>
      <AnimatePresence initial={false} custom={animation}>
        <CrossfadeItem
          key={contentKey}
          animation={animation}
          transition={transition}
        >
          {children}
        </CrossfadeItem>
      </AnimatePresence>
    </div>
  );
}

function CrossfadeItem({
  animation,
  children,
  transition,
}: {
  animation: CrossfadeAnimation;
  children: ReactNode;
  transition: { duration: number; ease?: "easeInOut" };
}) {
  const item = useStyles(styles.item);
  const isPresent = useIsPresent();

  return (
    <motion.div
      className={item}
      custom={animation}
      variants={itemVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={transition}
      aria-hidden={isPresent ? undefined : true}
      inert={!isPresent}
    >
      {children}
    </motion.div>
  );
}

type CrossfadeAnimation = {
  direction: CrossfadeDirection;
  distance: number;
};

const itemVariants: Variants = {
  enter: (animation: CrossfadeAnimation) => ({
    opacity: 0,
    ...directionOffset(animation, -1),
  }),
  center: { opacity: 1, x: 0, y: 0 },
  exit: (animation: CrossfadeAnimation) => ({
    opacity: 0,
    ...directionOffset(animation, 1),
  }),
};

function directionOffset(
  { direction, distance }: CrossfadeAnimation,
  multiplier: -1 | 1,
) {
  if (direction === "left") return { x: -distance * multiplier };
  if (direction === "right") return { x: distance * multiplier };
  if (direction === "up") return { y: -distance * multiplier };
  return { y: distance * multiplier };
}

const styles = {
  container: style({
    display: "grid",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
  }),
  item: style({
    display: "grid",
    gridArea: "1 / 1",
    minWidth: 0,
    minHeight: 0,
  }),
};
