import { useEffect, useRef, useState } from "react";
import type { RpcStub } from "capnweb";
import * as errore from "errore";
import { useQueryClient } from "@tanstack/react-query";
import type { AgentSessionApi } from "../../shared/rpc.js";
import { useApi } from "../api/ApiProvider.tsx";
import {
  agentSessionStateFromMessages,
  applyAgentSessionEvent,
  emptyAgentSessionState,
  type AgentSessionState,
} from "./AgentSessionState.ts";

export type AgentSessionStub = RpcStub<AgentSessionApi>;

class PromptFailedError extends errore.createTaggedError({
  name: "PromptFailedError",
  message: "Failed to send prompt: $reason",
}) {}

export type UseAgentSessionResult = {
  session: AgentSessionStub | null;
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
  const [session, setSession] = useState<AgentSessionStub | null>(null);
  const [state, setState] = useState<AgentSessionState>(emptyAgentSessionState);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stub: AgentSessionStub | undefined;

    setState(emptyAgentSessionState);
    setIsWorking(false);
    setSession(null);

    void api
      .readSessionTranscript(sessionId)
      .then((transcript) => {
        if (cancelled) return;
        setState(agentSessionStateFromMessages(transcript.messages));
      })
      .catch((e) => {
        console.warn("Failed to load session transcript:", e);
      });

    void api
      .openAgentSession(sessionId)
      .then((created) => {
        if (cancelled) {
          created[Symbol.dispose]();
          return;
        }
        stub = created;
        void created.subscribe((event) => {
          if (event.type === "agent_start") setIsWorking(true);
          if (event.type === "agent_end") setIsWorking(false);
          setState((current) => applyAgentSessionEvent(current, event));
        });
        setSession(() => created);
      })
      .catch((e) => {
        console.warn("Failed to open agent session:", e);
      });

    return () => {
      cancelled = true;
      stub?.[Symbol.dispose]();
      setSession(null);
    };
  }, [api, sessionId]);

  async function prompt(text: string) {
    if (session === null) {
      return new PromptFailedError({ reason: "Session is not ready." });
    }
    setState((current) => ({ ...current, error: null }));
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
    const transcript = await api.readSessionTranscript(sessionId);
    setState(agentSessionStateFromMessages(transcript.messages));
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
  const sessionRef = useRef<AgentSessionStub | null>(null);
  const [state, setState] = useState<AgentSessionState>(emptyAgentSessionState);
  const [isWorking, setIsWorking] = useState(false);
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;

  useEffect(() => {
    return () => {
      sessionRef.current?.[Symbol.dispose]();
      sessionRef.current = null;
    };
  }, []);

  async function prompt(text: string) {
    let session = sessionRef.current;
    if (session === null) {
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

    setState((current) => ({ ...current, error: null }));
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
    const transcript = await api.readSessionTranscript(sessionId);
    setState(agentSessionStateFromMessages(transcript.messages));
    await queryClient.invalidateQueries({
      queryKey: ["sessions"],
      refetchType: "all",
    });
    onCreatedRef.current(sessionId);
  }

  return { state, isWorking, prompt };
}
