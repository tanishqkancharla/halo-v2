import type { PromptStreamEvent } from "../src/api/SystemApi.js";

export const IPC = {
  getWorkspace: "halo:get-workspace",
  chooseWorkspace: "halo:choose-workspace",
  listSessions: "halo:list-sessions",
  readSessionTranscript: "halo:read-session-transcript",
  createSession: "halo:create-session",
  sendPrompt: "halo:send-prompt",
  promptEvent: "halo:prompt-event",
} as const;

export type PromptEventEnvelope = {
  requestId: string;
  event: PromptStreamEvent;
};
