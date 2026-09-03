import type { ProcessName, Program, Service } from "./Program.js";

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
