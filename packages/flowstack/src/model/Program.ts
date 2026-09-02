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
 * `from` sends, `to` receives. `children` is what `to` runs to handle it.
 * Nesting is causal: a callee sits under its caller, an event sits under the
 * frame that sends it, and a response sits beside its request.
 */
export type EventNode = {
  kind: "event";
  from: string;
  to: string;
  name: string;
  carrier: Carrier;
  detail?: string;
  children: FlowNode[];
};

/** A function in a service. `children` are the frames it calls and the events it sends. */
export type FrameNode = {
  kind: "frame";
  service: string;
  entry: string;
  summary?: string;
  source?: Source;
  children: FlowNode[];
};

export type FlowNode = EventNode | FrameNode;

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

/** A node with its position in the tree, `${parentKey}/${index}` per level. */
export type Keyed<T extends FlowNode = FlowNode> = { key: string; node: T };

export function keyed(nodes: FlowNode[], parentKey: string): Keyed[] {
  return nodes.map((node, index) => ({ key: `${parentKey}/${index}`, node }));
}

/**
 * The children with frame nodes removed. Events nested inside a frame move
 * up to where the frame was, in order, and keep their keys.
 */
export function eventChildren(
  nodes: FlowNode[],
  parentKey: string,
): Keyed<EventNode>[] {
  const result: Keyed<EventNode>[] = [];
  for (const { key, node } of keyed(nodes, parentKey)) {
    if (node.kind === "frame") {
      result.push(...eventChildren(node.children, key));
      continue;
    }
    result.push({ key, node });
  }
  return result;
}

/** Every node below `nodes`, pre-order. */
export function descendants(nodes: FlowNode[], parentKey: string): Keyed[] {
  const result: Keyed[] = [];
  for (const entry of keyed(nodes, parentKey)) {
    result.push(entry, ...descendants(entry.node.children, entry.key));
  }
  return result;
}
