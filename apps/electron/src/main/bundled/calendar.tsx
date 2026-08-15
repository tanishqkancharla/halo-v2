import { useState } from "react";
import {
  Button,
  backgroundColor,
  colors,
  flex,
  flexItem,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";

const weekdayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

function CalendarView() {
  const [cursor, setCursor] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });
  const pane = useStyles(styles.pane);
  const content = useStyles(styles.content);
  const header = useStyles(styles.header);
  const title = useStyles(styles.title);
  const nav = useStyles(styles.nav);
  const weekdays = useStyles(styles.weekdays);
  const weekday = useStyles(styles.weekday);
  const grid = useStyles(styles.grid);
  const today = new Date();
  const cells = calendarCells(cursor.year, cursor.month);
  const heading = monthFormatter.format(new Date(cursor.year, cursor.month, 1));

  return (
    <main className={pane} aria-label="Calendar" data-testid="calendar-view">
      <div className={content}>
        <header className={header}>
          <div className={title}>{heading}</div>
          <div className={nav}>
            <Button
              variant="quiet"
              aria-label="Previous month"
              onClick={() => setCursor(shiftMonth(cursor, -1))}
            >
              Previous
            </Button>
            <Button
              variant="quiet"
              aria-label="Next month"
              onClick={() => setCursor(shiftMonth(cursor, 1))}
            >
              Next
            </Button>
          </div>
        </header>
        <div className={weekdays}>
          {weekdayLabels.map((label) => (
            <div key={label} className={weekday}>
              {label}
            </div>
          ))}
        </div>
        <div className={grid} role="grid" aria-label={heading}>
          {cells.map((cell) => (
            <CalendarCell
              key={cell.key}
              cell={cell}
              currentMonth={cursor.month}
              today={today}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function CalendarCell({
  cell,
  currentMonth,
  today,
}: {
  cell: CalendarDay;
  currentMonth: number;
  today: Date;
}) {
  const inMonth = cell.month === currentMonth;
  const isToday =
    cell.year === today.getFullYear() &&
    cell.month === today.getMonth() &&
    cell.date === today.getDate();
  const day = useStyles(inMonth ? styles.day : styles.dayMuted);
  const todayClass = useStyles(styles.today);

  return (
    <div
      className={isToday ? `${day} ${todayClass}` : day}
      role="gridcell"
      aria-current={isToday ? "date" : undefined}
    >
      {cell.date}
    </div>
  );
}

type CalendarDay = {
  key: string;
  year: number;
  month: number;
  date: number;
};

type YearMonth = { year: number; month: number };

function shiftMonth(cursor: YearMonth, delta: number): YearMonth {
  const next = new Date(cursor.year, cursor.month + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

function calendarCells(year: number, month: number): CalendarDay[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const cells: CalendarDay[] = [];
  for (let index = 0; index < 42; index += 1) {
    const day = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + index,
    );
    cells.push({
      key: `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`,
      year: day.getFullYear(),
      month: day.getMonth(),
      date: day.getDate(),
    });
  }
  return cells;
}

const styles = {
  pane: style(
    flex({ direction: "column" }),
    spacing.padding({ x: 12, y: 12 }),
    {
      width: "100%",
      marginInline: "auto",
      minWidth: 0,
      minHeight: 0,
      overflow: "hidden",
      backgroundColor: backgroundColor.app,
    },
  ),
  content: style(flex({ direction: "column", gap: 6 }), {
    flex: "1 1 auto",
    width: "100%",
    maxWidth: "72ch",
    minWidth: 0,
    minHeight: 0,
    marginInline: "auto",
  }),
  header: style(flex({ align: "center", justify: "between" }), {
    minWidth: 0,
  }),
  title: style(flexItem({ size: "hug" }), text("md", 600, "highContrast"), {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  nav: style(flex({ align: "center", gap: 2 }), flexItem({ size: "hug" })),
  weekdays: style({
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    minWidth: 0,
  }),
  weekday: style(text("xs", 500, "lowContrast"), {
    textAlign: "center",
    paddingBlock: spacing.value(2),
  }),
  grid: style({
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    minWidth: 0,
  }),
  day: style(text("sm", 400, "highContrast"), {
    textAlign: "center",
    paddingBlock: spacing.value(4),
  }),
  dayMuted: style(text("sm", 400, "lowContrast"), {
    textAlign: "center",
    paddingBlock: spacing.value(4),
  }),
  today: style({
    borderRadius: "999px",
    backgroundColor: colors.accent[3],
    color: colors.accent[11],
    fontWeight: 500,
  }),
};

export default {
  sidebarEntries: [
    {
      id: "calendar",
      label: "Calendar",
      items: [{ id: "calendar.month", label: "Month", viewId: "month" }],
    },
  ],
  views: {
    month: CalendarView,
  },
};
