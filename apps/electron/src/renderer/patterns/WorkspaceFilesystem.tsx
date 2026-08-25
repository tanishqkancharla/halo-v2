import { SidebarSection } from "@halo/plugin-sdk/view";
import type { FileTree as FileTreeModel } from "@pierre/trees";
import { useEffect, useRef } from "react";
import type { WorkspaceTreeEvent } from "../../shared/rpc.js";
import type { HaloClient } from "../../shared/contract.js";
import {
  useApi,
  useWorkspace,
  useWorkspacePaths,
} from "../api/ApiProvider.tsx";
import { Filesystem } from "./Filesystem.tsx";

type WorkspaceFilesystemProps = {
  maxHeight?: number;
  className?: string;
};

export function WorkspaceFilesystem({
  maxHeight,
  className,
}: WorkspaceFilesystemProps) {
  const workspace = useWorkspace();
  const paths = useWorkspacePaths();
  const api = useApi();
  const modelRef = useRef<FileTreeModel | undefined>(undefined);
  const workspaceRoot =
    workspace?.status === "ready"
      ? workspace.workspace.workspaceRoot
      : undefined;

  useEffect(() => {
    if (workspaceRoot === undefined) return;

    const stop = listenWorkspaceTree(api, (events) => {
      applyTreeEvents(modelRef.current, events);
    });

    return () => {
      stop();
      modelRef.current = undefined;
    };
  }, [api, workspaceRoot]);

  if (workspaceRoot === undefined) return;
  if (paths === undefined) return;
  if (paths.length === 0) return;

  return (
    <SidebarSection label="Files" role="none" className={className}>
      <Filesystem
        key={workspaceRoot}
        paths={paths}
        maxHeight={maxHeight}
        onModel={(model) => {
          modelRef.current = model;
        }}
      />
    </SidebarSection>
  );
}

function listenWorkspaceTree(
  api: HaloClient,
  onEvents: (events: WorkspaceTreeEvent[]) => void,
) {
  let cancelled = false;
  let iterator:
    | Awaited<ReturnType<HaloClient["workspace"]["events"]>>
    | undefined;

  void (async () => {
    iterator = await api.workspace.events();
    for await (const events of iterator) {
      if (cancelled) return;
      onEvents(events);
    }
  })();

  return () => {
    cancelled = true;
    if (iterator === undefined) return;
    void iterator.return();
  };
}

function applyTreeEvents(
  model: FileTreeModel | undefined,
  events: WorkspaceTreeEvent[],
) {
  if (model === undefined) return;
  if (events.length === 0) return;

  model.batch(
    events.map((event) => {
      if (event.type === "create") {
        return { type: "add" as const, path: event.path };
      }
      return {
        type: "remove" as const,
        path: event.path,
        recursive: true,
      };
    }),
  );
}
