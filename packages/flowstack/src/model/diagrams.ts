import {
  eventChildren,
  type Flow,
  type FlowNode,
  type ProcessName,
  type Program,
  type Service,
} from "./Program.js";

const processOrder: ProcessName[] = ["outside", "renderer", "preload", "main"];

/** Composition DAG grouped by process. */
export function programMapSource(program: Program) {
  const byProcess = new Map<ProcessName, Service[]>();
  for (const service of program.services) {
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
    lines.push(`  subgraph ${process}Process["${process}"]`);
    for (const service of group) {
      lines.push(`    ${service.id}["${service.name}"]`);
    }
    lines.push("  end");
  }
  for (const service of program.services) {
    for (const child of service.composes) {
      lines.push(`  ${service.id} --> ${child}`);
    }
  }
  return lines.join("\n");
}

/**
 * The whole event tree as a sequence diagram, events in pre-order. Actors
 * are participants in first-seen order.
 */
export function flowSequenceSource(flow: Flow, services: Map<string, Service>) {
  const participants: string[] = [];
  const seen = new Set<string>();
  const participantId = (serviceId: string) => {
    if (!seen.has(serviceId)) {
      seen.add(serviceId);
      participants.push(serviceId);
    }
    return serviceId;
  };

  const lines: string[] = [];
  function emit(nodes: FlowNode[], parentKey: string) {
    for (const { key, node } of eventChildren(nodes, parentKey)) {
      const from = participantId(node.from);
      const to = participantId(node.to);
      lines.push(`  ${from}->>${to}: ${escapeLabel(node.name)}`);
      emit(node.children, key);
    }
  }
  emit(flow.children, flow.id);

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
