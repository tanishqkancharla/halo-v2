/**
 * A program is a DAG of services. Events cross between them, and between
 * them and the outside world. A flow is a tree: each event node holds what
 * its receiver does in response (its activation), which is more events and
 * the code frames that run. Frames nest by call, and the leaves are frames
 * with source. Go deep enough and every branch ends in code.
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

export type ProcessName = "renderer" | "preload" | "main" | "outside";

/** A node of the program DAG. Actors outside the program (a human, a model
 * provider, the disk) are services too, with process `outside`. */
export type Service = {
  id: string;
  name: string;
  process: ProcessName;
  description: string;
  state: StateField[];
  composes: string[];
};

/**
 * Shared by every node. `at` is the line in the parent frame's source where
 * the node starts. `guards` are the conditions, from earlier in the same
 * body, under which the node runs at all: `if (x) return` before it adds
 * `unless (x)`.
 */
type NodeBase = {
  at?: number;
  guards?: string[];
  children: FlowNode[];
};

/**
 * A call that crosses a service boundary. `from` sends, `to` receives.
 * `children` is what `to` runs to handle it, usually one frame, then the
 * reply when the sender waits for one. Nesting is causal: an event sits under
 * the frame that sends it.
 */
export type EventNode = NodeBase & {
  kind: "event";
  from: string;
  to: string;
  name: string;
  carrier: Carrier;
  args?: string;
  returns?: string;
  detail?: string;
  /** The sender's function, so the call can be shown where it sits. */
  callSite?: Source;
};

/**
 * The value an event's receiver sends back. `children` is what the sender
 * runs once it has the reply.
 */
type ReplyNode = NodeBase & {
  kind: "reply";
  /** The frame that returns. */
  name: string;
  from: string;
  to: string;
  carrier: Carrier;
  value?: string;
};

/** A function in a service. `children` are the frames it calls and the events it sends. */
type FrameNode = NodeBase & {
  kind: "frame";
  service: string;
  entry: string;
  summary?: string;
  source?: Source;
  returns?: string;
};

/**
 * A branch a frame's body takes: `if (...)`, `else if (...)`, `else`.
 * `children` are what runs inside it. `guard` is what the branch adds to the
 * conditions of everything inside it when it is folded away.
 */
type BranchNode = NodeBase & {
  kind: "branch";
  label: string;
  guard: string;
};

/** The frame returns here. `children` are the calls in the returned expression. */
type ReturnNode = NodeBase & {
  kind: "return";
  label: string;
};

export type FlowNode =
  | EventNode
  | ReplyNode
  | FrameNode
  | BranchNode
  | ReturnNode;

export type Flow = {
  id: string;
  title: string;
  description: string;
  children: FlowNode[];
};

export type Program = {
  name: string;
  services: Service[];
  flows: Flow[];
};

type EventInput = Omit<EventNode, "kind" | "children"> & {
  children?: FlowNode[];
};

type FrameInput = Omit<FrameNode, "kind" | "children"> & {
  children?: FlowNode[];
};

export function event(input: EventInput): EventNode {
  const { children, ...rest } = input;
  return {
    kind: "event",
    children: children === undefined ? [] : children,
    ...rest,
  };
}

export function frame(input: FrameInput): FrameNode {
  const { children, ...rest } = input;
  return {
    kind: "frame",
    children: children === undefined ? [] : children,
    ...rest,
  };
}

export function reply(input: Omit<ReplyNode, "kind">): ReplyNode {
  return { kind: "reply", ...input };
}

export function branch(input: Omit<BranchNode, "kind">): BranchNode {
  return { kind: "branch", ...input };
}

export function returns(input: Omit<ReturnNode, "kind">): ReturnNode {
  return { kind: "return", ...input };
}

/** A node with its position in the tree, `${parentKey}/${index}` per level. */
export type Keyed = { key: string; node: FlowNode };

export function keyed(nodes: FlowNode[], parentKey: string): Keyed[] {
  return nodes.map((node, index) => ({ key: `${parentKey}/${index}`, node }));
}

/** Every node below `nodes`, pre-order. */
export function descendants(nodes: FlowNode[], parentKey: string): Keyed[] {
  const result: Keyed[] = [];
  for (const entry of keyed(nodes, parentKey)) {
    result.push(entry, ...descendants(entry.node.children, entry.key));
  }
  return result;
}
