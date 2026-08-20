import { useEffect, useRef, useState } from "react";
import type { RpcStub } from "capnweb";
import * as errore from "errore";
import { useQueryClient } from "@tanstack/react-query";
import type { AgentSessionApi, AgentSessionState } from "../../shared/rpc.js";
import {
  applyAgentSessionEvent,
  emptyAgentSessionState,
} from "../../shared/AgentSessionState.js";
import { useApi } from "../api/ApiProvider.tsx";

export type AgentSessionStub = RpcStub<AgentSessionApi>;

class PromptFailedError extends errore.createTaggedError({
  name: "PromptFailedError",
  message: "$reason",
}) {}

export type UseAgentSessionResult = {
  session: AgentSessionStub | undefined;
  state: AgentSessionState;
  isWorking: boolean;
  prompt: (text: string) => Promise<void | PromptFailedError>;
};

/**
 * Opens a saved Pi session, subscribes to raw AgentSessionEvents, and folds
 * them into AgentSessionState for the feed.
 */
export function useAgentSession(sessionId: string): UseAgentSessionResult {
  const api = useApi();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AgentSessionStub | undefined>(
    undefined,
  );
  const [state, setState] = useState<AgentSessionState>(emptyAgentSessionState);
  const [isWorking, setIsWorking] = useState(false);
  const [openedFor, setOpenedFor] = useState(sessionId);

  if (openedFor !== sessionId) {
    setOpenedFor(sessionId);
    setSession(undefined);
    setState(emptyAgentSessionState);
    setIsWorking(false);
  }

  useEffect(() => {
    let cancelled = false;
    let stub: AgentSessionStub | undefined;

    // If cleanup runs before this resolves, `stub` is still unset — dispose the
    // late result here. Effect cleanup only covers stubs already assigned.
    void api
      .openAgentSession(sessionId)
      .then((opened) => {
        if (cancelled) {
          opened.session[Symbol.dispose]();
          return;
        }
        stub = opened.session;
        setState(opened.state);
        void opened.session.subscribe((event) => {
          if (event.type === "agent_start") setIsWorking(true);
          if (event.type === "agent_end") setIsWorking(false);
          setState((current) => applyAgentSessionEvent(current, event));
        });
        setSession(() => opened.session);
      })
      .catch((e) => {
        console.warn("Failed to open agent session:", e);
      });

    return () => {
      cancelled = true;
      stub?.[Symbol.dispose]();
    };
  }, [api, sessionId]);

  async function prompt(text: string) {
    if (session === undefined) {
      const error = new PromptFailedError({ reason: "Session is not ready." });
      setState((current) => ({ ...current, error: error.message }));
      return error;
    }
    setState((current) => ({ ...current, error: undefined }));
    const result = await session.prompt(text).catch(
      (e) =>
        new PromptFailedError({
          reason: e instanceof Error ? e.message : String(e),
          cause: e,
        }),
    );
    if (result instanceof Error) {
      setIsWorking(false);
      setState((current) => ({ ...current, error: result.message }));
      return result;
    }
    await queryClient.invalidateQueries({
      queryKey: ["sessions"],
      refetchType: "all",
    });
  }

  return { session, state, isWorking, prompt };
}

export type UseDraftAgentSessionResult = {
  state: AgentSessionState;
  isWorking: boolean;
  prompt: (text: string) => Promise<void | PromptFailedError>;
};

/**
 * Draft chat: creates a Pi session on first prompt, then behaves like
 * useAgentSession for that live session.
 */
export function useDraftAgentSession(
  onCreated: (sessionId: string) => void,
): UseDraftAgentSessionResult {
  const api = useApi();
  const queryClient = useQueryClient();
  const sessionRef = useRef<AgentSessionStub | undefined>(undefined);
  const [state, setState] = useState<AgentSessionState>(emptyAgentSessionState);
  const [isWorking, setIsWorking] = useState(false);
  const isWorkingRef = useRef(false);
  const openedRef = useRef(false);
  const onCreatedRef = useRef(onCreated);

  useEffect(() => {
    onCreatedRef.current = onCreated;
  }, [onCreated]);

  useEffect(() => {
    return () => {
      sessionRef.current?.[Symbol.dispose]();
      sessionRef.current = undefined;
    };
  }, []);

  async function prompt(text: string) {
    let session = sessionRef.current;
    if (session === undefined) {
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
      session = created;
      sessionRef.current = created;
      await created.subscribe((event) => {
        if (event.type === "agent_start") {
          isWorkingRef.current = true;
          setIsWorking(true);
        }
        if (event.type === "agent_end") {
          isWorkingRef.current = false;
          setIsWorking(false);
        }
        setState((current) => applyAgentSessionEvent(current, event));
      });
    }

    setState((current) => ({ ...current, error: undefined }));
    const result = await session.prompt(text).catch(
      (e) =>
        new PromptFailedError({
          reason: e instanceof Error ? e.message : String(e),
          cause: e,
        }),
    );
    if (result instanceof Error) {
      setIsWorking(false);
      isWorkingRef.current = false;
      setState((current) => ({ ...current, error: result.message }));
      return result;
    }
    await queryClient.invalidateQueries({
      queryKey: ["sessions"],
      refetchType: "all",
    });
    if (openedRef.current) return;
    if (isWorkingRef.current) return;
    openedRef.current = true;
    const sessionId = await session.getSessionId();
    onCreatedRef.current(sessionId);
  }

  return { state, isWorking, prompt };
}
