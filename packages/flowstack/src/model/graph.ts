import {
  eventChildren,
  keyed,
  type EventNode,
  type FlowNode,
  type FrameNode,
  type Keyed,
} from "./Program.js";

type ActorNode = { kind: "actor"; id: string; serviceId: string };
type FrameGraphNode = {
  kind: "frame";
  id: string;
  entry: Keyed<FrameNode>;
};
export type GraphNode = ActorNode | FrameGraphNode;

/** An event edge carries its node; a call edge (frame to frame) carries none. */
export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  step: number;
  event?: Keyed<EventNode>;
};

export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

/** What the chain of frames hangs off: the receiving actor or the calling frame. */
export type GraphRoot =
  | { kind: "actor"; serviceId: string }
  | { kind: "frame"; entry: Keyed<FrameNode> };

/**
 * The tree below a node as a graph, flattened to `depth` event levels.
 * Events are edges between actors, numbered in reading order. At the `code`
 * level frames appear too, chained by call order from the root or from the
 * actor that received their event; at the `events` level they are hidden and
 * their events hoisted.
 */
export function levelGraph(
  children: FlowNode[],
  parentKey: string,
  root: GraphRoot | undefined,
  level: "events" | "code",
  depth: number,
): Graph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  let step = 0;

  function actor(serviceId: string) {
    const id = `actor:${serviceId}`;
    if (!nodes.has(id)) nodes.set(id, { kind: "actor", id, serviceId });
    return id;
  }
  function frameNode(entry: Keyed<FrameNode>) {
    const id = `frame:${entry.key}`;
    nodes.set(id, { kind: "frame", id, entry });
    return id;
  }

  function visit(
    items: FlowNode[],
    itemsKey: string,
    start: string | undefined,
    depthLeft: number,
  ) {
    let cursor = start;
    const visible: Keyed[] =
      level === "events"
        ? eventChildren(items, itemsKey)
        : keyed(items, itemsKey);
    for (const item of visible) {
      step += 1;
      if (item.node.kind === "event") {
        const to = actor(item.node.to);
        edges.push({
          id: `e${step}`,
          from: actor(item.node.from),
          to,
          step,
          event: { key: item.key, node: item.node },
        });
        if (depthLeft > 1)
          visit(item.node.children, item.key, to, depthLeft - 1);
        continue;
      }
      const id = frameNode({ key: item.key, node: item.node });
      if (cursor !== undefined) {
        edges.push({ id: `e${step}`, from: cursor, to: id, step });
      }
      cursor = id;
    }
  }

  let start: string | undefined;
  if (root !== undefined) {
    start =
      root.kind === "actor" ? actor(root.serviceId) : frameNode(root.entry);
  }
  visit(children, parentKey, start, depth);

  return { nodes: [...nodes.values()], edges };
}
