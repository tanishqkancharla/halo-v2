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

class AbortFailedError extends errore.createTaggedError({
  name: "AbortFailedError",
  message: "$reason",
}) {}

class SessionEventStreamError extends errore.createTaggedError({
  name: "SessionEventStreamError",
  message: "Session event stream failed",
}) {}

type UseAgentSessionResult = {
  state: AgentSessionState;
  prompt: (text: string) => Promise<void | PromptFailedError>;
  abort: () => Promise<void | AbortFailedError>;
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
      | Awaited<ReturnType<HaloClient["sessions"]["events"]>>
      | undefined;

    void (async () => {
      const opened = await api.sessions.open({ sessionId }).catch(
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
      iterator = await api.sessions.events({ sessionId: opened.sessionId });
      for await (const event of iterator) {
        setState((current) => applyAgentSessionEvent(current, event));
      }
    })().catch((cause) => {
      reportSessionEventStreamError(cause, cancelled);
    });

    return () => {
      cancelled = true;
      if (iterator === undefined) return;
      void iterator.return().catch((cause) => {
        reportSessionEventStreamError(cause, true);
      });
    };
  }, [api, sessionId]);

  async function prompt(text: string) {
    if (readySessionId === undefined) {
      const error = new PromptFailedError({ reason: "Session is not ready." });
      setState((current) => ({ ...current, error: error.message }));
      return error;
    }
    setState((current) => ({ ...current, error: undefined }));
    const result = await api.sessions
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

  async function abort() {
    if (readySessionId === undefined) return;
    const result = await api.sessions
      .abort({ sessionId: readySessionId })
      .then(() => undefined)
      .catch(
        (e) =>
          new AbortFailedError({
            reason: e instanceof Error ? e.message : String(e),
            cause: e,
          }),
      );
    if (result instanceof AbortFailedError) {
      console.warn("Failed to stop session:", result);
      return result;
    }
  }

  return { state, prompt, abort };
}

function reportSessionEventStreamError(cause: unknown, cancelled: boolean) {
  const error = new SessionEventStreamError({ cause });
  if (cancelled && errore.isAbortError(error)) return;
  console.warn("Session event stream failed:", error);
}

type UseDraftAgentSessionResult = {
  state: AgentSessionState;
  sessionId: string | undefined;
  prompt: (text: string) => Promise<void | PromptFailedError>;
  abort: () => Promise<void | AbortFailedError>;
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
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const sessionIdRef = useRef<string | undefined>(undefined);
  const onCreatedRef = useRef(onCreated);

  useEffect(() => {
    onCreatedRef.current = onCreated;
  }, [onCreated]);

  async function prompt(text: string) {
    const created = await api.sessions.create().catch(
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
    sessionIdRef.current = created.sessionId;
    setSessionId(created.sessionId);
    onCreatedRef.current(created.sessionId);

    setState((current) => ({ ...current, error: undefined }));
    const result = await api.sessions
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

  async function abort() {
    const createdSessionId = sessionIdRef.current;
    if (createdSessionId === undefined) return;
    const result = await api.sessions
      .abort({ sessionId: createdSessionId })
      .then(() => undefined)
      .catch(
        (e) =>
          new AbortFailedError({
            reason: e instanceof Error ? e.message : String(e),
            cause: e,
          }),
      );
    if (result instanceof AbortFailedError) {
      console.warn("Failed to stop session:", result);
      return result;
    }
  }

  return { state, sessionId, prompt, abort };
}
