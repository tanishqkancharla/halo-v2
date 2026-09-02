import { useEffect, useRef } from "react";
import * as errore from "errore";
import { useQueryClient } from "@tanstack/react-query";
import { useApi } from "../api/ApiProvider.tsx";
import type { HaloClient } from "../../shared/contract.js";

const autosaveDelayMs = 400;

class WorkspaceFileWriteError extends errore.createTaggedError({
  name: "WorkspaceFileWriteError",
  message: "Failed to write $path",
}) {}

type AutosaveRefs = {
  api: { current: HaloClient };
  path: { current: string };
  lastWritten: { current: string };
  pending: { current: string | undefined };
  timer: { current: ReturnType<typeof setTimeout> | undefined };
  setCachedFile: { current: (path: string, content: string) => void };
};

function flushAutosave(refs: AutosaveRefs) {
  if (refs.timer.current !== undefined) {
    clearTimeout(refs.timer.current);
    refs.timer.current = undefined;
  }
  const pending = refs.pending.current;
  refs.pending.current = undefined;
  if (pending === undefined) return;
  if (pending === refs.lastWritten.current) return;
  const path = refs.path.current;
  refs.lastWritten.current = pending;
  refs.setCachedFile.current(path, pending);
  void refs.api.current.workspace
    .writeFile({ path, content: pending })
    .catch((cause) => {
      console.warn(new WorkspaceFileWriteError({ path, cause }));
    });
}

export function useAutosaveFile(args: { path: string; loaded: string }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const apiRef = useRef(api);
  const pathRef = useRef(args.path);
  const lastWrittenRef = useRef(args.loaded);
  const pendingRef = useRef<string | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setCachedFileRef = useRef((path: string, content: string) => {
    queryClient.setQueryData(["workspace-file", path], content);
  });

  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  useEffect(() => {
    setCachedFileRef.current = (path: string, content: string) => {
      queryClient.setQueryData(["workspace-file", path], content);
    };
  }, [queryClient]);

  useEffect(() => {
    pathRef.current = args.path;
    lastWrittenRef.current = args.loaded;
    pendingRef.current = undefined;
  }, [args.path, args.loaded]);

  useEffect(() => {
    return () => {
      flushAutosave({
        api: apiRef,
        path: pathRef,
        lastWritten: lastWrittenRef,
        pending: pendingRef,
        timer: timerRef,
        setCachedFile: setCachedFileRef,
      });
    };
  }, []);

  return {
    onChange(markdown: string) {
      if (markdown === lastWrittenRef.current) return;
      pendingRef.current = markdown;
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = undefined;
        flushAutosave({
          api: apiRef,
          path: pathRef,
          lastWritten: lastWrittenRef,
          pending: pendingRef,
          timer: timerRef,
          setCachedFile: setCachedFileRef,
        });
      }, autosaveDelayMs);
    },
  };
}
