import { step, type Story } from "./Story.js";

const renderer = "apps/electron/src/renderer";
const server = "packages/server/src";
const pi = "node_modules/@earendil-works";

export const promptStory: Story = {
  id: "prompt-story",
  title: "Send a prompt (story)",
  description:
    "The same send path told in sentences. Each step opens into the steps inside it, down to the code that runs.",
  steps: [
    step({
      text: "You press Cmd-Enter in the composer. The renderer checks the draft and hands the text to the session hook.",
      process: "renderer",
      steps: [
        step({
          text: "The editor sees Cmd/Ctrl-Enter, swallows the keystroke, and calls the composer's submit. Plain Enter falls through and adds a newline.",
          process: "renderer",
          source: {
            path: `${renderer}/main/agent/Editor.tsx`,
            start: 93,
            end: 100,
          },
        }),
        step({
          text: "The composer trims the draft and stops if it is empty. Otherwise it clears the draft right away and passes the text on. If the send later fails, it puts the text back.",
          process: "renderer",
          when: "stops when the draft is empty",
          source: {
            path: `${renderer}/main/agent/AgentPane.tsx`,
            start: 119,
            end: 127,
          },
        }),
        step({
          text: "The session hook refuses if the session is not open yet and shows an error instead.",
          process: "renderer",
          when: "only before sessions.open has resolved",
          source: {
            path: `${renderer}/main/agent/useAgentSession.ts`,
            start: 89,
            end: 94,
          },
        }),
      ],
    }),
    step({
      text: "The renderer sends sessions.prompt to the main process and waits for the reply.",
      process: "renderer",
      steps: [
        step({
          text: "The hook clears any old error and calls api.sessions.prompt({ sessionId, text }). It awaits the reply, which does not come until the agent turn ends.",
          process: "renderer",
          source: {
            path: `${renderer}/main/agent/useAgentSession.ts`,
            start: 95,
            end: 105,
          },
        }),
        step({
          text: "The call travels over oRPC on a MessagePort that the preload handed over at startup. Per-prompt traffic goes straight from renderer to main.",
          process: "renderer",
          source: {
            path: `${renderer}/api/HaloRpcClient.ts`,
            start: 6,
            end: 12,
          },
        }),
        step({
          text: "Main's sessionsRouter.prompt handler receives it and logs one line.",
          process: "main",
          source: {
            path: `${server}/sessions/sessionsRouter.ts`,
            start: 51,
            end: 61,
          },
        }),
      ],
    }),
    step({
      text: "Main opens the session and hands the text to Pi, which starts the agent run.",
      process: "main",
      steps: [
        step({
          text: "SessionRegistry.open returns the live session from memory. It is almost always there, because the pane opened it on mount.",
          process: "main",
          source: {
            path: `${server}/sessions/SessionRegistry.ts`,
            start: 31,
            end: 42,
          },
        }),
        step({
          text: "Only when the session is not open yet does main build one from disk: list the session files, open the right one, and load the tool runtime.",
          process: "main",
          when: "only when the session is not open",
          source: {
            path: `${server}/agent/HaloAgentSession.ts`,
            start: 100,
            end: 124,
          },
          steps: [
            step({
              text: "On a fresh install, loading the runtime reads user.json and writes it if missing. That is the only disk write on this path.",
              process: "main",
              when: "only on a fresh install",
              source: {
                path: `${server}/UserService.ts`,
                start: 33,
                end: 58,
              },
            }),
          ],
        }),
        step({
          text: 'HaloAgentSession.prompt passes the text to Pi\'s AgentSession.prompt with streamingBehavior: "steer".',
          process: "main",
          source: {
            path: `${server}/agent/HaloAgentSession.ts`,
            start: 202,
            end: 214,
          },
        }),
        step({
          text: "If a turn is already running, Pi queues the text as a steering message and returns. No new run starts.",
          process: "outside",
          when: "only while a turn is running",
          source: {
            path: `${pi}/pi-coding-agent/dist/core/agent-session.js`,
            start: 826,
            end: 840,
          },
        }),
        step({
          text: "Otherwise Pi checks the provider auth, builds the user message, and starts the agent run.",
          process: "outside",
          source: {
            path: `${pi}/pi-coding-agent/dist/core/agent-session.js`,
            start: 910,
            end: 917,
          },
        }),
      ],
    }),
    step({
      text: "Pi runs the turn. Every event streams back to the renderer, which updates the pane as it goes.",
      process: "main",
      steps: [
        step({
          text: "The run opens with agent_start, turn_start, and the user message, then loops on the model.",
          process: "outside",
          source: {
            path: `${pi}/pi-agent-core/dist/agent-loop.js`,
            start: 43,
            end: 56,
          },
        }),
        step({
          text: "HaloAgentSession forwards each Pi event onto its own event stream.",
          process: "main",
          source: {
            path: `${server}/agent/HaloAgentSession.ts`,
            start: 82,
            end: 86,
          },
        }),
        step({
          text: "The renderer's sessions.events subscription, opened when the pane mounted, receives each event and folds it into pane state.",
          process: "renderer",
          source: {
            path: `${renderer}/main/agent/useAgentSession.ts`,
            start: 71,
            end: 75,
          },
        }),
        step({
          text: "The pane shows your message and a Thinking turn, and the Send button becomes Stop. The model's streamed reply follows; that is its own story.",
          process: "renderer",
        }),
      ],
    }),
    step({
      text: "When the turn ends, main replies to sessions.prompt and the renderer refreshes the session list.",
      process: "main",
      steps: [
        step({
          text: "sessionsRouter.prompt returns nothing once session.prompt resolves. On failure it returns a bad-request error instead.",
          process: "main",
          source: {
            path: `${server}/sessions/sessionsRouter.ts`,
            start: 57,
            end: 60,
          },
        }),
        step({
          text: "Back in the hook, a failure shows the error and stops. Otherwise it marks the sessions query stale.",
          process: "renderer",
          when: "stops on failure",
          source: {
            path: `${renderer}/main/agent/useAgentSession.ts`,
            start: 106,
            end: 117,
          },
        }),
        step({
          text: "useSessionsQuery refetches by calling sessions.list, renderer to main.",
          process: "renderer",
          source: {
            path: `${renderer}/api/ApiProvider.tsx`,
            start: 117,
            end: 129,
          },
        }),
        step({
          text: "Main reads the session headers from disk and replies with the summaries. The sidebar re-renders with the new title and order.",
          process: "main",
          source: {
            path: `${server}/sessions/sessionsRouter.ts`,
            start: 18,
            end: 23,
          },
        }),
      ],
    }),
  ],
};
