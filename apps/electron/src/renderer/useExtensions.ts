import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import type {
  ExtensionBundle,
  ExtensionLoadError,
} from "../shared/extension.ts";
import type { LoadedExtension } from "../shared/evaluateExtensionSource.ts";
import { useApi, useWorkspaceQuery } from "./api/ApiProvider.tsx";
import { loadCompiledExtension } from "./loadExtensionModule.ts";

const extensionsQueryKey = (workspaceRoot: string | undefined) =>
  ["extensions", workspaceRoot] as const;

export function useLoadedExtensions() {
  const api = useApi();
  const queryClient = useQueryClient();
  const workspaceQuery = useWorkspaceQuery();
  const workspace = workspaceQuery.data;
  const workspaceRoot =
    workspace?.status === "ready"
      ? workspace.workspace.workspaceRoot
      : undefined;

  const query = useQuery({
    queryKey: extensionsQueryKey(workspaceRoot),
    queryFn: () => api.listExtensions(),
    enabled: workspaceRoot !== undefined,
  });

  useEffect(() => {
    if (workspaceRoot === undefined) return;

    api.subscribeExtensions((bundle) => {
      queryClient.setQueryData(extensionsQueryKey(workspaceRoot), bundle);
    });

    return () => {
      api.subscribeExtensions(() => {});
    };
  }, [api, queryClient, workspaceRoot]);

  return useMemo(() => loadExtensionBundle(query.data), [query.data]);
}

export function loadExtensionBundle(bundle: ExtensionBundle | undefined) {
  if (bundle === undefined) {
    return {
      extensions: [] as LoadedExtension[],
      errors: [] as ExtensionLoadError[],
    };
  }

  const extensions: LoadedExtension[] = [];
  const errors: ExtensionLoadError[] = [...bundle.errors];
  for (const compiled of bundle.extensions) {
    const loaded = loadCompiledExtension(compiled);
    if (loaded instanceof Error) {
      errors.push({ id: compiled.id, message: loaded.message });
      continue;
    }
    extensions.push(loaded);
  }
  return { extensions, errors };
}
