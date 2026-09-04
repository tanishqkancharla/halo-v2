import { useEffect, useRef, useState } from "react";
import * as errore from "errore";
import { useQueryClient } from "@tanstack/react-query";
import {
  projectSession,
  type ProjectedSession,
  type SessionLogRecord,
} from "@get-halo/shared/sessionLog";
import { useApi } from "../../api/ApiProvider.tsx";
import type { HaloClient } from "@get-halo/shared/contract";
import {
  applyConnectionEvent,
  connectionStateQueryKey,
  type ConnectionState,
} from "./ConnectionState.ts";

class PromptFailedError extends errore.createTaggedError({
  name: "PromptFailedError",
  message: "$reason",
}) {}

class AbortFailedError extends errore.createTaggedError({
  name: "AbortFailedError",
  message: "$reason",
}) {}

type UseAgentSessionResult = {
  state: ProjectedSession;
  prompt: (text: string) => Promise<void | PromptFailedError>;
  abort: () => Promise<void | AbortFailedError>;
};

/**
 * Opens a saved session and projects its durable event records.
 */
export function useAgentSession(sessionId: string): UseAgentSessionResult {
  const api = useApi();
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  const [readySessionId, setReadySessionId] = useState<string | undefined>(
    undefined,
  );
  const [records, setRecords] = useState<SessionLogRecord[]>([]);
  const [localError, setLocalError] = useState<string | undefined>(undefined);
  const [openedFor, setOpenedFor] = useState(sessionId);

  if (openedFor !== sessionId) {
    setOpenedFor(sessionId);
    setReadySessionId(undefined);
    setRecords([]);
    setLocalError(undefined);
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
      setRecords(opened.records);
      setReadySessionId(opened.sessionId);
      iterator = await api.sessions.events({
        sessionId: opened.sessionId,
        afterSequence: opened.cursor,
      });
      for await (const record of iterator) {
        setRecords((current) => [...current, record]);
        const event = record.value;
        if (event.type === "halo.connection") {
          queryClientRef.current.setQueryData<ConnectionState>(
            connectionStateQueryKey(event.request),
            (current) => applyConnectionEvent(current, event),
          );
        }
      }
    })().catch((cause) => {
      if (cancelled && errore.isAbortError(cause)) return;
      console.warn("Session event stream failed:", cause);
    });

    return () => {
      cancelled = true;
      if (iterator === undefined) return;
      void iterator.return().catch((cause) => {
        if (errore.isAbortError(cause)) return;
        console.warn("Failed to close session event stream:", cause);
      });
    };
  }, [api, sessionId]);

  async function prompt(text: string) {
    if (readySessionId === undefined) {
      const error = new PromptFailedError({ reason: "Session is not ready." });
      setLocalError(error.message);
      return error;
    }
    setLocalError(undefined);
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
      setLocalError(result.message);
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

  return { state: projectRecords(records, localError), prompt, abort };
}

type UseDraftAgentSessionResult = {
  state: ProjectedSession;
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
  const [localError, setLocalError] = useState<string | undefined>(undefined);
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
      setLocalError(created.message);
      return created;
    }
    sessionIdRef.current = created.sessionId;
    setSessionId(created.sessionId);
    onCreatedRef.current(created.sessionId);

    setLocalError(undefined);
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
      setLocalError(result.message);
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

  return {
    state: projectRecords([], localError),
    sessionId,
    prompt,
    abort,
  };
}

function projectRecords(
  records: readonly SessionLogRecord[],
  localError: string | undefined,
): ProjectedSession {
  const projected = projectSession(records.map((record) => record.value));
  if (localError === undefined) return projected;
  return { ...projected, error: localError, isWorking: false };
}
