import { SidebarItem, SidebarSection } from "@halo/plugin-sdk/view";
import { useQueryClient } from "@tanstack/react-query";
import * as errore from "errore";
import { useEffect, useMemo } from "react";
import { File, Folder } from "maui/icons";
import type { HaloClient } from "@repo/shared/contract";
import type { WorkspaceTreeEvent } from "@repo/shared/rpc";
import {
  useApi,
  useWorkspacePathsQuery,
  useWorkspaceQuery,
  workspacePathsQueryKey,
} from "../api/ApiProvider.tsx";

class WorkspaceTreeStreamError extends errore.createTaggedError({
  name: "WorkspaceTreeStreamError",
  message: "Workspace tree stream failed",
}) {}

type FileNavigationNode = {
  path: string;
  name: string;
  isDirectory: boolean;
  children: FileNavigationNode[];
};

export function FilesystemSection() {
  const workspace = useWorkspaceQuery().data;
  const pathsQuery = useWorkspacePathsQuery(workspace);
  const queryClient = useQueryClient();
  const api = useApi();
  const files = useMemo(
    () =>
      pathsQuery.data === undefined ? [] : buildFileNavigation(pathsQuery.data),
    [pathsQuery.data],
  );
  const workspaceRoot =
    workspace?.status === "ready"
      ? workspace.workspace.workspaceRoot
      : undefined;

  useEffect(() => {
    if (workspaceRoot === undefined) return;

    const controller = new AbortController();
    listenWorkspaceTree(api, controller.signal, (events) => {
      queryClient.setQueryData(
        workspacePathsQueryKey(workspaceRoot),
        (current: string[] | undefined) => {
          if (current === undefined) return current;
          return applyPathEvents(current, events);
        },
      );
    }).catch((cause) => {
      const error = new WorkspaceTreeStreamError({ cause });
      if (!controller.signal.aborted) console.warn(error.message, error);
    });

    return () => controller.abort();
  }, [api, queryClient, workspaceRoot]);

  if (files.length === 0) return undefined;
  return (
    <SidebarSection label="Files">
      {files.map((node) => (
        <FileNavigationItem key={node.path} node={node} />
      ))}
    </SidebarSection>
  );
}

function FileNavigationItem({ node }: { node: FileNavigationNode }) {
  return (
    <SidebarItem
      id={`file:${node.path}`}
      href={node.isDirectory ? undefined : fileRoute(node.path)}
      pageTitle={node.name}
      icon={node.isDirectory ? Folder : File}
      items={node.children.map((child) => (
        <FileNavigationItem key={child.path} node={child} />
      ))}
    >
      {node.name}
    </SidebarItem>
  );
}

function buildFileNavigation(paths: readonly string[]) {
  const roots: FileNavigationNode[] = [];
  const nodes = new Map<string, FileNavigationNode>();

  for (const listedPath of paths) {
    const terminalIsDirectory = listedPath.endsWith("/");
    const normalizedPath = terminalIsDirectory
      ? listedPath.slice(0, -1)
      : listedPath;
    const segments = normalizedPath.split("/");
    let siblings = roots;

    for (const [index, name] of segments.entries()) {
      const isDirectory = index < segments.length - 1 || terminalIsDirectory;
      const path = `${segments.slice(0, index + 1).join("/")}${
        isDirectory ? "/" : ""
      }`;
      const existing = nodes.get(path);
      const node =
        existing === undefined
          ? { path, name, isDirectory, children: [] }
          : existing;
      if (existing === undefined) {
        nodes.set(path, node);
        siblings.push(node);
      }
      siblings = node.children;
    }
  }

  sortFileNavigation(roots);
  return roots;
}

function sortFileNavigation(nodes: FileNavigationNode[]) {
  nodes.sort((left, right) => {
    if (left.isDirectory !== right.isDirectory) {
      return left.isDirectory ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
  for (const node of nodes) sortFileNavigation(node.children);
}

function fileRoute(path: string) {
  return `/files/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function listenWorkspaceTree(
  api: HaloClient,
  signal: AbortSignal,
  onEvents: (events: WorkspaceTreeEvent[]) => void,
) {
  const events = await api.workspace.events(undefined, { signal });
  for await (const event of events) onEvents(event);
}

function applyPathEvents(paths: string[], events: WorkspaceTreeEvent[]) {
  return events.reduce((next, event) => {
    if (event.type === "create") {
      if (next.includes(event.path)) return next;
      return [...next, event.path];
    }
    return next.filter((path) => {
      if (path === event.path) return false;
      return !path.startsWith(`${event.path}/`);
    });
  }, paths);
}
