/**
 * A program is a DAG of services. Events cross its boundary in both
 * directions. A flow is one inbound event and the path it follows.
 *
 * A path at any level reads `[E_in, S, E_out]`. Clicking into `S` shows the
 * path through the services `S` composes, down to source lines.
 */

/** The boundary an event crosses. */
export type Carrier =
  | "ui"
  | "ipc"
  | "rpc"
  | "http"
  | "filesystem"
  | "process"
  | "network"
  | "memory";

export type ProgramEvent = {
  name: string;
  carrier: Carrier;
  detail?: string;
};

export type StateField = {
  name: string;
  type: string;
};

/** Repository-relative file and 1-based inclusive line range. */
export type Source = {
  path: string;
  start: number;
  end: number;
};

export type Frame = {
  service: string;
  entry: string;
  summary?: string;
  source?: Source;
  inner?: Path;
};

/**
 * `in` enters the enclosing service from outside it, `out` leaves it, and
 * `hop` moves between two services the enclosing service composes.
 */
type Step =
  | { kind: "in"; event: ProgramEvent }
  | { kind: "hop"; event: ProgramEvent }
  | { kind: "out"; event: ProgramEvent }
  | { kind: "frame"; frame: Frame };

export type Path = Step[];

export type ProcessName = "app" | "renderer" | "preload" | "main" | "outside";

export type Service = {
  id: string;
  name: string;
  process: ProcessName;
  description: string;
  state: StateField[];
  composes: string[];
};

export type Flow = {
  id: string;
  title: string;
  description: string;
  path: Path;
};

export type Program = {
  name: string;
  services: Service[];
  flows: Flow[];
};

export function inbound(event: ProgramEvent): Step {
  return { kind: "in", event };
}

export function hop(event: ProgramEvent): Step {
  return { kind: "hop", event };
}

export function outbound(event: ProgramEvent): Step {
  return { kind: "out", event };
}

export function frame(value: Frame): Step {
  return { kind: "frame", frame: value };
}
