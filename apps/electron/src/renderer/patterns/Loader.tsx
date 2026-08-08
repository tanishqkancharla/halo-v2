import { useEffect, useRef, useState } from "react";
import { colors, motion } from "maui";
import { style, useStyles } from "purse-styles";

const GRID_SIZE = 3;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const TICK_MS = 220;
const ALIVE_PROBABILITY = 0.45;
const HISTORY_LENGTH = 4;

type Cells = boolean[];

function randomCells(): Cells {
  return Array.from(
    { length: CELL_COUNT },
    () => Math.random() < ALIVE_PROBABILITY,
  );
}

function cellsKey(cells: Cells) {
  return cells.map((alive) => (alive ? "1" : "0")).join("");
}

function countLiveNeighbors(cells: Cells, index: number) {
  const row = Math.floor(index / GRID_SIZE);
  const col = index % GRID_SIZE;
  let count = 0;

  for (let dRow = -1; dRow <= 1; dRow++) {
    for (let dCol = -1; dCol <= 1; dCol++) {
      if (dRow === 0 && dCol === 0) continue;

      const neighborRow = row + dRow;
      const neighborCol = col + dCol;
      if (
        neighborRow < 0 ||
        neighborRow >= GRID_SIZE ||
        neighborCol < 0 ||
        neighborCol >= GRID_SIZE
      ) {
        continue;
      }

      if (cells[neighborRow * GRID_SIZE + neighborCol]) {
        count++;
      }
    }
  }

  return count;
}

// Standard Conway's Game of Life rules on a bounded (non-wrapping) grid.
function step(cells: Cells): Cells {
  return cells.map((alive, index) => {
    const neighbors = countLiveNeighbors(cells, index);
    return alive ? neighbors === 2 || neighbors === 3 : neighbors === 3;
  });
}

type LoaderVariant = "primary" | "accent" | "muted";

type LoaderProps = {
  size?: string;
  variant?: LoaderVariant;
  className?: string;
  "aria-label"?: string;
};

// A 3x3 dot grid, text-sized, that simulates Conway's Game of Life starting
// from a random orientation. A small grid dies out or freezes quickly, so
// whenever the simulation goes extinct or repeats a recent state, it reseeds
// with a fresh random pattern to keep animating like a loading indicator.
export function Loader({
  size = "1em",
  variant = "primary",
  className,
  "aria-label": ariaLabel = "Loading",
}: LoaderProps) {
  const [cells, setCells] = useState<Cells>(() => randomCells());
  const historyRef = useRef<string[]>([cellsKey(cells)]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCells((current) => {
        const next = step(current);
        const nextKey = cellsKey(next);
        const isStale =
          next.every((alive) => !alive) || historyRef.current.includes(nextKey);

        const resolved = isStale ? randomCells() : next;
        historyRef.current = [...historyRef.current, cellsKey(resolved)].slice(
          -HISTORY_LENGTH,
        );

        return resolved;
      });
    }, TICK_MS);

    return () => clearInterval(interval);
  }, []);

  const gridClassName = useStyles(gridClass, variantStyles[variant]);
  const dotClassName = useStyles(
    dotClass,
    motion.standard("opacity", "background-color"),
  );

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={joinClassNames(gridClassName, className)}
      style={{ width: size, height: size }}
    >
      {cells.map((alive, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={dotClassName}
          data-alive={alive ? "true" : undefined}
        />
      ))}
    </span>
  );
}

const variantStyles = {
  primary: style({
    color: "currentColor",
  }),
  accent: style({
    color: colors.accent[10],
  }),
  muted: style({
    color: colors.gray[11],
  }),
} as const;

const gridClass = style({
  display: "inline-grid",
  gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
  gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
  gap: "14%",
  verticalAlign: "-0.05em",
  flexShrink: 0,
});

const dotClass = style({
  borderRadius: "50%",
  backgroundColor: "currentColor",
  opacity: 0,
  "&[data-alive='true']": {
    opacity: 1,
  },
});

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}
