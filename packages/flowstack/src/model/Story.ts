import type { ProcessName, Source } from "./Program.js";

/**
 * One sentence about what happens, who does it, and when. `steps` say the
 * same thing in more detail; a step with `source` and no `steps` is the code.
 */
export type Step = {
  text: string;
  process?: ProcessName;
  when?: string;
  source?: Source;
  steps: Step[];
};

export type Story = {
  id: string;
  title: string;
  description: string;
  steps: Step[];
};

export function step(input: Omit<Step, "steps"> & { steps?: Step[] }): Step {
  return { ...input, steps: input.steps === undefined ? [] : input.steps };
}
