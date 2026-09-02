import type { Flow, Path, ProcessName, Program, Service } from "./Program.js";

const processOrder: ProcessName[] = ["renderer", "preload", "main", "outside"];

/** Composition DAG grouped by process. The root app node is left out. */
export function programMapSource(program: Program) {
  const byProcess = new Map<ProcessName, Service[]>();
  for (const service of program.services) {
    if (service.process === "app") continue;
    const group = byProcess.get(service.process);
    if (group === undefined) {
      byProcess.set(service.process, [service]);
      continue;
    }
    group.push(service);
  }
  const lines = ["graph LR"];
  for (const process of processOrder) {
    const group = byProcess.get(process);
    if (group === undefined) continue;
    lines.push(`  subgraph ${process}`);
    for (const service of group) {
      lines.push(`    ${service.id}["${service.name}"]`);
    }
    lines.push("  end");
  }
  for (const service of program.services) {
    if (service.process === "app") continue;
    for (const child of service.composes) {
      lines.push(`  ${service.id} --> ${child}`);
    }
  }
  return lines.join("\n");
}

/**
 * One level of a flow as a sequence diagram. Frames become participants in
 * first-seen order; hops label the arrows between consecutive frames.
 */
export function flowSequenceSource(flow: Flow, services: Map<string, Service>) {
  const root = flow.path.find((step) => step.kind === "frame");
  const path: Path =
    root !== undefined &&
    root.kind === "frame" &&
    root.frame.inner !== undefined
      ? root.frame.inner
      : flow.path;

  const participants: string[] = [];
  const seen = new Set<string>();
  const participantId = (serviceId: string) => {
    if (!seen.has(serviceId)) {
      seen.add(serviceId);
      participants.push(serviceId);
    }
    return serviceId;
  };
  const world = "outside";
  participantId(world);

  const lines: string[] = [];
  let current = world;
  let pendingHop: string | undefined;
  for (const step of path) {
    if (step.kind === "in") {
      lines.push(`  Note over ${world}: ${escapeLabel(step.event.name)}`);
      continue;
    }
    if (step.kind === "hop") {
      pendingHop = step.event.name;
      continue;
    }
    if (step.kind === "out") {
      lines.push(`  ${current}-->>${world}: ${escapeLabel(step.event.name)}`);
      continue;
    }
    const target = participantId(step.frame.service);
    const label = pendingHop === undefined ? step.frame.entry : pendingHop;
    pendingHop = undefined;
    if (target === current) {
      lines.push(`  Note over ${target}: ${escapeLabel(label)}`);
      continue;
    }
    lines.push(`  ${current}->>${target}: ${escapeLabel(label)}`);
    current = target;
  }

  const header = participants.map((id) => {
    const service = services.get(id);
    const name = service === undefined ? id : service.name;
    return `  participant ${id} as ${escapeLabel(name)}`;
  });
  return ["sequenceDiagram", ...header, ...lines].join("\n");
}

function escapeLabel(value: string) {
  return value.replaceAll(":", "∶").replaceAll(";", ",");
}
