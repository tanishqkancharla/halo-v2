import { useEffect, useRef, useState } from "react";
import * as errore from "errore";
import { useQueryClient } from "@tanstack/react-query";
import type { AgentSessionState } from "../../shared/AgentSessionState.js";
import {
  applyAgentSessionEvent,
  emptyAgentSessionState,
} from "../../shared/AgentSessionState.js";
import { useApi } from "../api/ApiProvider.tsx";
import type { HaloClient } from "../../shared/contract.js";

class PromptFailedError extends errore.createTaggedError({
  name: "PromptFailedError",
  message: "$reason",
}) {}

export type UseAgentSessionResult = {
  state: AgentSessionState;
  prompt: (text: string) => Promise<void | PromptFailedError>;
};

/**
 * Opens a saved Pi session and folds AgentSessionEvents into AgentSessionState.
 */
export function useAgentSession(sessionId: string): UseAgentSessionResult {
  const api = useApi();
  const queryClient = useQueryClient();
  const [readySessionId, setReadySessionId] = useState<string | undefined>(
    undefined,
  );
  const [state, setState] = useState<AgentSessionState>(emptyAgentSessionState);
  const [openedFor, setOpenedFor] = useState(sessionId);

  if (openedFor !== sessionId) {
    setOpenedFor(sessionId);
    setReadySessionId(undefined);
    setState(emptyAgentSessionState);
  }

  useEffect(() => {
    let cancelled = false;
    let iterator:
      | Awaited<ReturnType<HaloClient["agentSession"]["events"]>>
      | undefined;

    void (async () => {
      const opened = await api.openAgentSession({ sessionId }).catch(
        (e) =>
          new PromptFailedError({
            reason: e instanceof Error ? e.message : String(e),
            cause: e,
          }),
      );
      if (opened instanceof Error) {
        console.warn("Failed to open agent session:", opened);
        return;
      }
      if (cancelled) return;
      setState(opened.state);
      setReadySessionId(opened.sessionId);
      iterator = await api.agentSession.events({ sessionId: opened.sessionId });
      for await (const event of iterator) {
        setState((current) => applyAgentSessionEvent(current, event));
      }
    })();

    return () => {
      cancelled = true;
      if (iterator === undefined) return;
      void iterator.return();
    };
  }, [api, sessionId]);

  async function prompt(text: string) {
    if (readySessionId === undefined) {
      const error = new PromptFailedError({ reason: "Session is not ready." });
      setState((current) => ({ ...current, error: error.message }));
      return error;
    }
    setState((current) => ({ ...current, error: undefined }));
    const result = await api.agentSession
      .prompt({ sessionId: readySessionId, text })
      .then(() => undefined)
      .catch(
        (e) =>
          new PromptFailedError({
            reason: e instanceof Error ? e.message : String(e),
            cause: e,
          }),
      );
    if (result instanceof PromptFailedError) {
      setState((current) => ({
        ...current,
        isWorking: false,
        error: result.message,
      }));
      return result;
    }
    await queryClient.invalidateQueries({
      queryKey: ["sessions"],
      refetchType: "all",
    });
  }

  return { state, prompt };
}

export type UseDraftAgentSessionResult = {
  state: AgentSessionState;
  prompt: (text: string) => Promise<void | PromptFailedError>;
};

/**
 * Draft chat: creates a Pi session on first prompt, then navigates to that id.
 */
export function useDraftAgentSession(
  onCreated: (sessionId: string) => void,
): UseDraftAgentSessionResult {
  const api = useApi();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AgentSessionState>(emptyAgentSessionState);
  const onCreatedRef = useRef(onCreated);

  useEffect(() => {
    onCreatedRef.current = onCreated;
  }, [onCreated]);

  async function prompt(text: string) {
    const created = await api.newAgentSession().catch(
      (e) =>
        new PromptFailedError({
          reason: e instanceof Error ? e.message : String(e),
          cause: e,
        }),
    );
    if (created instanceof Error) {
      setState((current) => ({ ...current, error: created.message }));
      return created;
    }
    onCreatedRef.current(created.sessionId);

    setState((current) => ({ ...current, error: undefined }));
    const result = await api.agentSession
      .prompt({ sessionId: created.sessionId, text })
      .then(() => undefined)
      .catch(
        (e) =>
          new PromptFailedError({
            reason: e instanceof Error ? e.message : String(e),
            cause: e,
          }),
      );
    if (result instanceof PromptFailedError) {
      setState((current) => ({
        ...current,
        isWorking: false,
        error: result.message,
      }));
      return result;
    }
    await queryClient.invalidateQueries({
      queryKey: ["sessions"],
      refetchType: "all",
    });
  }

  return { state, prompt };
}
