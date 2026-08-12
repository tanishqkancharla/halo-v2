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
};

export function WorkspaceFilesystem({ maxHeight }: WorkspaceFilesystemProps) {
  const workspaceQuery = useWorkspaceQuery();
  const workspace = workspaceQuery.data;
  const pathsQuery = useWorkspacePathsQuery(workspace);
  const api = useApi();
  const modelRef = useRef<FileTreeModel | null>(null);
  const workspaceRoot =
    workspace?.status === "ready" ? workspace.workspace.workspaceRoot : null;

  useEffect(() => {
    if (workspaceRoot === null) return;

    api.subscribeWorkspaceTree((events) => {
      applyTreeEvents(modelRef.current, events);
    });

    return () => {
      api.subscribeWorkspaceTree(() => {});
      modelRef.current = null;
    };
  }, [api, workspaceRoot]);

  if (workspaceRoot === null) return null;
  if (pathsQuery.data === undefined) return null;

  return (
    <Filesystem
      key={workspaceRoot}
      paths={pathsQuery.data}
      maxHeight={maxHeight}
      onModel={(model) => {
        modelRef.current = model;
      }}
    />
  );
}

function applyTreeEvents(
  model: FileTreeModel | null,
  events: WorkspaceTreeEvent[],
) {
  if (model === null) return;
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
