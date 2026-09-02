import type { Frame, Path, ProgramEvent } from "./Program.js";

export type FrameNode = {
  kind: "frame";
  id: string;
  serviceId: string;
  frames: { key: string; frame: Frame }[];
};

type EventNode = {
  kind: "event";
  id: string;
  direction: "in" | "out";
  event: ProgramEvent;
};

/** The neighbour just outside the zoomed frame, drawn as a ghost. */
type BoundaryNode = {
  kind: "boundary";
  id: string;
  direction: "in" | "out";
  label: string;
};

export type GraphNode = FrameNode | EventNode | BoundaryNode;

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  step: number;
  hop?: ProgramEvent;
};

export type PathGraph = { nodes: GraphNode[]; edges: GraphEdge[] };

export type Boundary = { from?: string; to?: string };

/**
 * One node per service, so a service the path visits twice (renderer → main
 * → renderer) is one box with two entries. Edges follow path order and carry
 * the hop event that sits between two frames.
 */
export function pathGraph(
  path: Path,
  parentKey: string,
  boundary: Boundary,
): PathGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  let step = 0;
  let previous: string | undefined;
  let lastFrame: string | undefined;
  let pendingHop: ProgramEvent | undefined;

  function connect(from: string, to: string) {
    if (from === to) return;
    step += 1;
    edges.push({ id: `e${step}`, from, to, step, hop: pendingHop });
    pendingHop = undefined;
  }

  if (boundary.from !== undefined) {
    const id = "boundary:in";
    nodes.set(id, {
      kind: "boundary",
      id,
      direction: "in",
      label: boundary.from,
    });
    previous = id;
  }

  path.forEach((current, index) => {
    const key = `${parentKey}/${index}`;
    switch (current.kind) {
      case "in": {
        const id = `in:${index}`;
        nodes.set(id, {
          kind: "event",
          id,
          direction: "in",
          event: current.event,
        });
        previous = id;
        return;
      }
      case "hop": {
        pendingHop = current.event;
        return;
      }
      case "frame": {
        const id = `svc:${current.frame.service}`;
        const existing = nodes.get(id);
        if (existing === undefined || existing.kind !== "frame") {
          nodes.set(id, {
            kind: "frame",
            id,
            serviceId: current.frame.service,
            frames: [{ key, frame: current.frame }],
          });
        } else {
          existing.frames.push({ key, frame: current.frame });
        }
        if (previous !== undefined) connect(previous, id);
        previous = id;
        lastFrame = id;
        return;
      }
      case "out": {
        const id = `out:${index}`;
        nodes.set(id, {
          kind: "event",
          id,
          direction: "out",
          event: current.event,
        });
        if (previous !== undefined) connect(previous, id);
        return;
      }
    }
  });

  if (boundary.to !== undefined && lastFrame !== undefined) {
    const id = "boundary:out";
    nodes.set(id, {
      kind: "boundary",
      id,
      direction: "out",
      label: boundary.to,
    });
    connect(lastFrame, id);
  }

  return { nodes: [...nodes.values()], edges };
}

/** The frames on either side of `index` in `path`, for a zoomed-in boundary. */
export function boundaryAround(
  path: Path,
  index: number,
  serviceName: (id: string) => string,
): Boundary {
  let from: string | undefined;
  for (let i = index - 1; i >= 0; i -= 1) {
    const step = path[i];
    if (step === undefined) continue;
    if (step.kind === "frame") {
      from = serviceName(step.frame.service);
      break;
    }
    if (step.kind === "in") {
      from = step.event.name;
      break;
    }
  }
  let to: string | undefined;
  for (let i = index + 1; i < path.length; i += 1) {
    const step = path[i];
    if (step === undefined) continue;
    if (step.kind === "frame") {
      to = serviceName(step.frame.service);
      break;
    }
  }
  return { from, to };
}
