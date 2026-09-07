import { useEffect, useRef, useState } from "react";
import * as errore from "errore";
import { useQueryClient } from "@tanstack/react-query";
import { useApi } from "../api/ApiProvider.tsx";
import type { HaloClient } from "@get-halo/shared/contract";

const autosaveDelayMs = 400;

class WorkspaceFileWriteError extends errore.createTaggedError({
  name: "WorkspaceFileWriteError",
  message: "Failed to write $path",
}) {}

export type AutosaveStatus =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; error: WorkspaceFileWriteError };

type AutosaveRefs = {
  api: { current: HaloClient };
  path: { current: string };
  lastWritten: { current: string };
  pending: { current: string | undefined };
  timer: { current: ReturnType<typeof setTimeout> | undefined };
  setCachedFile: { current: (path: string, content: string) => void };
  invalidateCachedFile: { current: (path: string) => void };
  onStatusChange: { current: (status: AutosaveStatus) => void };
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
  const previous = refs.lastWritten.current;
  refs.lastWritten.current = pending;
  refs.setCachedFile.current(path, pending);
  refs.onStatusChange.current({ status: "saving" });
  void refs.api.current.workspace
    .writeFile({ path, content: pending })
    .then(() => {
      refs.onStatusChange.current({ status: "saved" });
    })
    .catch((cause) => {
      const error = new WorkspaceFileWriteError({ path, cause });
      console.warn(error);
      // Roll back only if a later edit has not since advanced lastWritten,
      // so concurrent inflight writes do not clobber each other. The cache
      // invalidation below is the authoritative reconciliation: it refetches
      // the disk's true content, which re-seeds lastWritten via the loaded
      // effect. The explicit rollback covers the brief window before that
      // refetch resolves, so an exact-identical retype retries immediately.
      if (refs.lastWritten.current === pending) {
        refs.lastWritten.current = previous;
      }
      refs.invalidateCachedFile.current(path);
      refs.onStatusChange.current({ status: "error", error });
    });
}

export function useAutosaveFile(args: { path: string; loaded: string }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AutosaveStatus>({ status: "idle" });
  const apiRef = useRef(api);
  const pathRef = useRef(args.path);
  const previousPathRef = useRef(args.path);
  const lastWrittenRef = useRef(args.loaded);
  const pendingRef = useRef<string | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setCachedFileRef = useRef((path: string, content: string) => {
    queryClient.setQueryData(["workspace-file", path], content);
  });
  const invalidateCachedFileRef = useRef((path: string) => {
    void queryClient
      .invalidateQueries({ queryKey: ["workspace-file", path] })
      .catch((cause) =>
        console.warn("Failed to invalidate workspace file query:", cause),
      );
  });
  const onStatusChangeRef = useRef((next: AutosaveStatus) => {
    setStatus(next);
  });

  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  useEffect(() => {
    setCachedFileRef.current = (path: string, content: string) => {
      queryClient.setQueryData(["workspace-file", path], content);
    };
    invalidateCachedFileRef.current = (path: string) => {
      void queryClient
        .invalidateQueries({ queryKey: ["workspace-file", path] })
        .catch((cause) =>
          console.warn("Failed to invalidate workspace file query:", cause),
        );
    };
    onStatusChangeRef.current = (next: AutosaveStatus) => {
      setStatus(next);
    };
  }, [queryClient]);

  // On a path change (opening a different file) drop pending edits from the
  // prior file and re-seed state from the new file's content. On a same-file
  // loaded change — i.e. the cache refetch we trigger after a failed write —
  // only re-sync lastWritten to the disk truth, so a user edit that landed
  // during the refetch window is still written rather than silently dropped.
  useEffect(() => {
    if (previousPathRef.current !== args.path) {
      previousPathRef.current = args.path;
      pendingRef.current = undefined;
    }
    pathRef.current = args.path;
    lastWrittenRef.current = args.loaded;
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
        invalidateCachedFile: invalidateCachedFileRef,
        onStatusChange: onStatusChangeRef,
      });
    };
  }, []);

  return {
    status,
    onChange(markdown: string) {
      if (markdown === lastWrittenRef.current) return;
      pendingRef.current = markdown;
      if (status.status === "error") setStatus({ status: "idle" });
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
          invalidateCachedFile: invalidateCachedFileRef,
          onStatusChange: onStatusChangeRef,
        });
      }, autosaveDelayMs);
    },
  };
}
