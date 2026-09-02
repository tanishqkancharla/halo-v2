import { useMemo, useState } from "react";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  backgroundColor,
  border,
  colors,
  flex,
  flexItem,
  navigationItem,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";
import { flowSequenceSource, programMapSource } from "../model/diagrams.js";
import { haloProgram } from "../model/halo.js";
import {
  descendants,
  type Flow,
  type ProcessName,
  type Program,
  type Service,
} from "../model/Program.js";
import { ProcessBadge, StateChip } from "./badges.tsx";
import { carrierIcons, carrierLabels } from "./carriers.tsx";
import { MermaidBlock } from "./MermaidBlock.tsx";
import { FlowGraph } from "./FlowGraph.tsx";
import { PaneStack } from "./PaneStack.tsx";
import { CallStack } from "./CallStack.tsx";
import { StackGraph } from "./StackGraph.tsx";
import {
  FlowTree,
  sourceKey,
  type Expansion,
  type TreeLevel,
} from "./FlowTree.tsx";

type Selection = { kind: "map" } | { kind: "flow"; id: string };
type FlowView =
  | "stackGraph"
  | "tree"
  | "stack"
  | "panes"
  | "graph"
  | "sequence";

const program = haloProgram;
const services = new Map(
  program.services.map((service) => [service.id, service]),
);

export function FlowstackApp() {
  const firstFlow = program.flows[0];
  const [selection, setSelection] = useState<Selection>(
    firstFlow === undefined
      ? { kind: "map" }
      : { kind: "flow", id: firstFlow.id },
  );
  const [view, setView] = useState<FlowView>("stackGraph");
  const [level, setLevel] = useState<TreeLevel>("code");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const expansion: Expansion = {
    isExpanded: (key) => expanded.has(key),
    open: (keys) =>
      setExpanded((current) => {
        const next = new Set(current);
        for (const key of keys) next.add(key);
        return next;
      }),
    toggle: (key) =>
      setExpanded((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
  };

  const shell = useStyles(styles.shell);
  const header = useStyles(styles.header);
  const title = useStyles(styles.title);
  const subtitle = useStyles(styles.subtitle);
  const body = useStyles(styles.body);
  const sidebar = useStyles(styles.sidebar);
  const sectionLabel = useStyles(styles.sectionLabel);
  const navItem = useStyles(navigationItem, styles.navItem);

  const selectedFlow =
    selection.kind === "flow"
      ? program.flows.find((flow) => flow.id === selection.id)
      : undefined;
  const fullBleed =
    selectedFlow !== undefined &&
    (view === "panes" || view === "graph" || view === "stackGraph");
  const main = useStyles(
    styles.main,
    fullBleed ? styles.mainFullBleed : styles.mainPadded,
  );

  return (
    <div className={shell}>
      <header className={header}>
        <div>
          <div className={title}>{program.name} — event flows</div>
          <div className={subtitle}>
            A flow is a tree of events between actors. Open an event to see what
            its receiver does: the events it sends and, at the code level, the
            frames that run. Every branch ends in source.
          </div>
        </div>
      </header>
      <div className={body}>
        <nav className={sidebar} aria-label="Flows">
          <div className={sectionLabel}>Program</div>
          <button
            type="button"
            className={navItem}
            aria-current={selection.kind === "map" ? "page" : undefined}
            onClick={() => setSelection({ kind: "map" })}
          >
            Services and state
          </button>
          <div className={sectionLabel}>Event flows</div>
          {program.flows.map((flow) => (
            <button
              key={flow.id}
              type="button"
              className={navItem}
              aria-current={
                selection.kind === "flow" && selection.id === flow.id
                  ? "page"
                  : undefined
              }
              onClick={() => setSelection({ kind: "flow", id: flow.id })}
            >
              <FlowLabel flow={flow} />
            </button>
          ))}
        </nav>
        <main className={main}>
          {selectedFlow === undefined ? (
            <ProgramMap program={program} />
          ) : (
            <FlowPage
              key={selectedFlow.id}
              flow={selectedFlow}
              services={services}
              view={view}
              onViewChange={setView}
              level={level}
              onLevelChange={setLevel}
              expansion={expansion}
              onExpandAll={() =>
                setExpanded((current) => {
                  const next = new Set(current);
                  for (const { key, node } of descendants(
                    selectedFlow.children,
                    selectedFlow.id,
                  )) {
                    next.add(key);
                    if (node.kind === "frame" && node.source !== undefined) {
                      next.add(sourceKey(key));
                    }
                  }
                  return next;
                })
              }
              onCollapseAll={() =>
                setExpanded((current) => {
                  const next = new Set<string>();
                  for (const key of current) {
                    if (!key.startsWith(`${selectedFlow.id}/`)) next.add(key);
                  }
                  return next;
                })
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}

function FlowLabel(props: { flow: Flow }) {
  const first = props.flow.children[0];
  const label = useStyles(styles.flowLabel);
  const icon = useStyles(styles.flowIcon);
  if (first === undefined || first.kind !== "event") {
    return <span>{props.flow.title}</span>;
  }
  const Icon = carrierIcons[first.carrier];
  return (
    <span className={label}>
      <span className={icon}>
        <Icon size="xs" />
      </span>
      {props.flow.title}
    </span>
  );
}

function FlowPage(props: {
  flow: Flow;
  services: Map<string, Service>;
  view: FlowView;
  onViewChange: (view: FlowView) => void;
  level: TreeLevel;
  onLevelChange: (level: TreeLevel) => void;
  expansion: Expansion;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  const { view, level } = props;
  const page = useStyles(styles.page);
  const heading = useStyles(styles.heading);
  const description = useStyles(styles.description);
  const toolbar = useStyles(styles.toolbar);
  const toolbarSpacer = useStyles(styles.toolbarSpacer);
  const toolbarDivider = useStyles(styles.toolbarDivider);
  const stackShell = useStyles(styles.stackShell);
  const panesPage = useStyles(styles.panesPage);
  const panesToolbar = useStyles(styles.panesToolbar);
  const panesBody = useStyles(styles.panesBody);
  const sequence = useMemo(
    () => flowSequenceSource(props.flow, props.services),
    [props.flow, props.services],
  );

  const toolbarLabel = useStyles(styles.toolbarLabel);
  const graphLevel = level === "events" ? "events" : "code";
  const levelButtons = (withSource: boolean) => (
    <>
      <span className={toolbarLabel}>Level</span>
      <Button
        variant={level === "events" ? "default" : "quiet"}
        onClick={() => props.onLevelChange("events")}
      >
        Events
      </Button>
      <Button
        variant={
          level === "code" || (!withSource && level === "source")
            ? "default"
            : "quiet"
        }
        onClick={() => props.onLevelChange("code")}
      >
        Code
      </Button>
      {withSource ? (
        <Button
          variant={level === "source" ? "default" : "quiet"}
          onClick={() => props.onLevelChange("source")}
        >
          Source
        </Button>
      ) : undefined}
    </>
  );
  const viewButtons = (
    <>
      <span className={toolbarLabel}>View</span>
      <Button
        variant={view === "stackGraph" ? "default" : "quiet"}
        onClick={() => props.onViewChange("stackGraph")}
      >
        Stack graph
      </Button>
      <Button
        variant={view === "tree" ? "default" : "quiet"}
        onClick={() => props.onViewChange("tree")}
      >
        Tree
      </Button>
      <Button
        variant={view === "stack" ? "default" : "quiet"}
        onClick={() => props.onViewChange("stack")}
      >
        Call stack
      </Button>
      <Button
        variant={view === "panes" ? "default" : "quiet"}
        onClick={() => props.onViewChange("panes")}
      >
        Panes
      </Button>
      <Button
        variant={view === "graph" ? "default" : "quiet"}
        onClick={() => props.onViewChange("graph")}
      >
        Graph
      </Button>
      <Button
        variant={view === "sequence" ? "default" : "quiet"}
        onClick={() => props.onViewChange("sequence")}
      >
        Sequence
      </Button>
    </>
  );

  if (view === "panes" || view === "graph" || view === "stackGraph") {
    return (
      <div className={panesPage}>
        <div className={panesToolbar}>
          {viewButtons}
          {view === "graph" || view === "stackGraph" ? (
            <>
              <span className={toolbarSpacer} />
              {levelButtons(false)}
              {view === "stackGraph" ? (
                <>
                  <span className={toolbarDivider} />
                  <Button variant="quiet" onClick={props.onExpandAll}>
                    Expand all
                  </Button>
                  <Button variant="quiet" onClick={props.onCollapseAll}>
                    Collapse all
                  </Button>
                </>
              ) : undefined}
            </>
          ) : undefined}
        </div>
        <div className={panesBody}>
          {view === "panes" ? (
            <PaneStack flow={props.flow} services={props.services} />
          ) : view === "stackGraph" ? (
            <StackGraph
              nodes={props.flow.children}
              parentKey={props.flow.id}
              services={props.services}
              level={graphLevel}
              expansion={props.expansion}
            />
          ) : (
            <FlowGraph
              flow={props.flow}
              services={props.services}
              level={graphLevel}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={page}>
      <div>
        <h1 className={heading}>{props.flow.title}</h1>
        <p className={description}>{props.flow.description}</p>
      </div>
      <div className={toolbar}>
        {viewButtons}
        {view === "tree" || view === "stack" ? (
          <>
            <span className={toolbarSpacer} />
            {levelButtons(true)}
            <span className={toolbarDivider} />
            <Button variant="quiet" onClick={props.onExpandAll}>
              Expand all
            </Button>
            <Button variant="quiet" onClick={props.onCollapseAll}>
              Collapse all
            </Button>
          </>
        ) : undefined}
      </div>
      {view === "tree" ? (
        <div className={stackShell}>
          <FlowTree
            nodes={props.flow.children}
            parentKey={props.flow.id}
            services={props.services}
            level={level}
            expansion={props.expansion}
          />
        </div>
      ) : view === "stack" ? (
        <CallStack
          nodes={props.flow.children}
          parentKey={props.flow.id}
          services={props.services}
          level={level}
          expansion={props.expansion}
        />
      ) : (
        <MermaidBlock source={sequence} />
      )}
      <Legend />
    </div>
  );
}

const processOrder: ProcessName[] = ["outside", "renderer", "preload", "main"];

function Legend() {
  const legend = useStyles(styles.legend);
  const group = useStyles(styles.legendGroup);
  const muted = useStyles(styles.legendLabel);
  return (
    <div className={legend}>
      <div className={group}>
        <span className={muted}>Process</span>
        {processOrder.map((process) => (
          <ProcessBadge key={process} process={process} />
        ))}
      </div>
      <div className={group}>
        <span className={muted}>Event carrier</span>
        {Object.entries(carrierLabels).map(([carrier, label]) => {
          // SAFETY: carrierLabels is a Record keyed by Carrier, so its entry keys are Carrier values.
          const Icon = carrierIcons[carrier as keyof typeof carrierIcons];
          return (
            <span key={carrier} className={group}>
              <Icon size="xs" />
              <span className={muted}>{label}</span>
            </span>
          );
        })}
      </div>
      <div className={group}>
        <span className={muted}>Service state</span>
        <StateChip field={{ name: "field", type: "what the service stores" }} />
      </div>
    </div>
  );
}

function ProgramMap(props: { program: Program }) {
  const page = useStyles(styles.page);
  const heading = useStyles(styles.heading);
  const description = useStyles(styles.description);
  const muted = useStyles(styles.legendLabel);
  const chips = useStyles(styles.stateChips);
  const source = useMemo(
    () => programMapSource(props.program),
    [props.program],
  );
  return (
    <div className={page}>
      <div>
        <h1 className={heading}>Services and state</h1>
        <p className={description}>
          The program as a DAG. An arrow means the parent composes the child.
          The table lists the state each service stores; a code change is a
          change to this state or to the path an event takes through these
          nodes.
        </p>
      </div>
      <MermaidBlock source={source} />
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Service</TableHeaderCell>
            <TableHeaderCell>Process</TableHeaderCell>
            <TableHeaderCell>State</TableHeaderCell>
            <TableHeaderCell>Role</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {props.program.services.map((service) => (
            <TableRow key={service.id}>
              <TableCell>{service.name}</TableCell>
              <TableCell>
                <ProcessBadge process={service.process} />
              </TableCell>
              <TableCell>
                {service.state.length === 0 ? (
                  <span className={muted}>stateless</span>
                ) : (
                  <span className={chips}>
                    {service.state.map((field) => (
                      <StateChip key={field.name} field={field} />
                    ))}
                  </span>
                )}
              </TableCell>
              <TableCell>{service.description}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const styles = {
  shell: style(flex({ direction: "column" }), {
    width: "100%",
    height: "100vh",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: backgroundColor.app,
  }),
  header: style(
    flex({ direction: "row", align: "center", justify: "between" }),
    spacing.padding({ x: 8, y: 4 }),
    flexItem({ size: "hug" }),
    border(["bottom"], "border"),
    {
      minWidth: 0,
      backgroundColor: backgroundColor.app,
    },
  ),
  title: style(text({ size: "md", fontWeight: 600, color: "highContrast" })),
  subtitle: style(text({ size: "xs", fontWeight: 400, color: "lowContrast" })),
  body: style(flex({ direction: "row" }), {
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
  }),
  sidebar: style(
    flex({ direction: "column", gap: 1 }),
    spacing.padding({ all: 4 }),
    border(["right"], "border"),
    {
      width: "232px",
      flex: "0 0 auto",
      overflowY: "auto",
      backgroundColor: colors.gray[2],
    },
  ),
  sectionLabel: style(
    text({ size: "xs", fontWeight: 500, color: "lowContrast" }),
    spacing.padding({ x: 4, top: 4, bottom: 1 }),
    {
      letterSpacing: "0.02em",
    },
  ),
  navItem: style({
    display: "block",
    width: "100%",
    border: 0,
    textAlign: "left",
    background: "transparent",
    cursor: "pointer",
  }),
  flowLabel: style(flex({ direction: "row", align: "center", gap: 3 })),
  flowIcon: style({
    display: "inline-flex",
    color: colors.gray[10],
  }),
  main: style({
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
  }),
  mainPadded: style(spacing.padding({ x: 12, y: 8 }), {
    overflowY: "auto",
  }),
  mainFullBleed: style(flex({ direction: "column" }), {
    overflow: "hidden",
  }),
  panesPage: style(flex({ direction: "column" }), {
    width: "100%",
    height: "100%",
    minWidth: 0,
    minHeight: 0,
  }),
  panesToolbar: style(
    flex({ direction: "row", align: "center", gap: 2 }),
    spacing.padding({ x: 4, y: 2 }),
    border(["bottom"], "border"),
    {
      flex: "0 0 auto",
      backgroundColor: backgroundColor.app,
    },
  ),
  panesBody: style({
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
  }),
  page: style(flex({ direction: "column", gap: 6 }), {
    width: "100%",
    maxWidth: "1040px",
    marginInline: "auto",
    minWidth: 0,
  }),
  heading: style(text({ size: "xl", fontWeight: 600, color: "highContrast" }), {
    margin: 0,
  }),
  description: style(
    text({ size: "sm", fontWeight: 400, color: "lowContrast" }),
    {
      margin: 0,
      marginTop: spacing.value(2),
      maxWidth: "72ch",
    },
  ),
  toolbar: style(
    flex({ direction: "row", align: "center", gap: 2, wrap: true }),
  ),
  toolbarSpacer: style({ flex: "1 1 auto" }),
  toolbarLabel: style(
    text({ size: "xs", fontWeight: 500, color: "lowContrast" }),
    {
      marginRight: spacing.value(1),
    },
  ),
  toolbarDivider: style({
    width: "1px",
    height: "16px",
    marginInline: spacing.value(2),
    backgroundColor: colors.gray[6],
  }),
  stackShell: style(spacing.padding({ y: 3, x: 2 }), {
    borderRadius: "8px",
    border: `1px solid ${colors.gray[5]}`,
    backgroundColor: backgroundColor.element,
    minWidth: 0,
  }),
  legend: style(
    flex({ direction: "row", align: "center", gap: 8, wrap: true }),
    {
      paddingTop: spacing.value(4),
      borderTop: `1px solid ${colors.gray[5]}`,
    },
  ),
  legendGroup: style(
    flex({ direction: "row", align: "center", gap: 2, wrap: true }),
    {
      color: colors.gray[11],
    },
  ),
  legendLabel: style(
    text({ size: "xs", fontWeight: 400, color: "lowContrast" }),
  ),
  stateChips: style(
    flex({ direction: "row", align: "center", gap: 1, wrap: true }),
  ),
};
