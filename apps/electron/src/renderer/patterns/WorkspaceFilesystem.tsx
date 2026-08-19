import { SidebarSection } from "@halo/plugin-sdk/view";
import type { FileTree as FileTreeModel } from "@pierre/trees";
import { useEffect, useRef } from "react";
import type { WorkspaceTreeEvent } from "../../shared/rpc.js";
import {
  useApi,
  useWorkspacePathsQuery,
  useWorkspaceQuery,
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
  const workspaceQuery = useWorkspaceQuery();
  const workspace = workspaceQuery.data;
  const pathsQuery = useWorkspacePathsQuery(workspace);
  const api = useApi();
  const modelRef = useRef<FileTreeModel | undefined>(undefined);
  const workspaceRoot =
    workspace?.status === "ready"
      ? workspace.workspace.workspaceRoot
      : undefined;

  useEffect(() => {
    if (workspaceRoot === undefined) return;

    api.subscribeWorkspaceTree((events) => {
      applyTreeEvents(modelRef.current, events);
    });

    return () => {
      api.subscribeWorkspaceTree(() => {});
      modelRef.current = undefined;
    };
  }, [api, workspaceRoot]);

  if (workspaceRoot === undefined) return;
  if (pathsQuery.data === undefined) return;
  if (pathsQuery.data.length === 0) return;

  return (
    <SidebarSection label="Files" role="none" className={className}>
      <Filesystem
        key={workspaceRoot}
        paths={pathsQuery.data}
        maxHeight={maxHeight}
        onModel={(model) => {
          modelRef.current = model;
        }}
      />
    </SidebarSection>
  );
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
