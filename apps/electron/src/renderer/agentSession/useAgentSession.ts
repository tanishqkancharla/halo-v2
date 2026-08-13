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
  message: "Failed to send prompt: $reason",
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

  useEffect(() => {
    let cancelled = false;
    let stub: AgentSessionStub | undefined;

    setState(emptyAgentSessionState);
    setIsWorking(false);
    setSession(undefined);

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
      setSession(undefined);
    };
  }, [api, sessionId]);

  async function prompt(text: string) {
    if (session === undefined) {
      return new PromptFailedError({ reason: "Session is not ready." });
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

/**
 * Draft chat: creates a Pi session on first prompt, then behaves like
 * useAgentSession for that live session.
 */
export function useDraftAgentSession(onCreated: (sessionId: string) => void): {
  state: AgentSessionState;
  isWorking: boolean;
  prompt: (text: string) => Promise<void | PromptFailedError>;
} {
  const api = useApi();
  const queryClient = useQueryClient();
  const sessionRef = useRef<AgentSessionStub | undefined>(undefined);
  const [state, setState] = useState<AgentSessionState>(emptyAgentSessionState);
  const [isWorking, setIsWorking] = useState(false);
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;

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
        if (event.type === "agent_start") setIsWorking(true);
        if (event.type === "agent_end") setIsWorking(false);
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
      setState((current) => ({ ...current, error: result.message }));
      return result;
    }
    const sessionId = await session.getSessionId();
    await queryClient.invalidateQueries({
      queryKey: ["sessions"],
      refetchType: "all",
    });
    onCreatedRef.current(sessionId);
  }

  return { state, isWorking, prompt };
}
