import { useEffect, useEffectEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  background,
  Button,
  Dialog,
  Flex,
  H2,
  radius,
  shadow,
  Text,
  Tooltip,
} from "maui";
import { Shield } from "maui/icons";
import { style, useStyles } from "purse-styles";
import * as errore from "errore";
import type { ExtensionPermissionRequest } from "@get-halo/shared/contract";
import { useApi } from "./api/ApiProvider.js";

class ExtensionPermissionsError extends errore.createTaggedError({
  name: "ExtensionPermissionsError",
  message: "Could not load extension permissions",
}) {}

const permissionsKey = ["extension-permissions"];

export function ExtensionPermissionRequests({
  extensionId,
}: {
  extensionId?: string;
}) {
  const api = useApi();
  const requestList = useStyles(permissionRequests);
  const queryClient = useQueryClient();
  const [requests, setRequests] = useState<ExtensionPermissionRequest[]>([]);
  const [error, setError] = useState<Error>();
  const receiveRequests = useEffectEvent(
    async (pending: ExtensionPermissionRequest[]) => {
      setRequests(pending);
      await queryClient.invalidateQueries({ queryKey: permissionsKey });
    },
  );
  useEffect(() => {
    const controller = new AbortController();
    async function listen() {
      const events = await api.extensions.tools.requests(undefined, {
        signal: controller.signal,
      });
      for await (const pending of events) {
        await receiveRequests(pending);
      }
    }
    void listen().catch((cause) => {
      if (controller.signal.aborted) return;
      const failure = new ExtensionPermissionsError({ cause });
      console.warn(failure);
      setError(failure);
    });
    return () => controller.abort();
  }, [api]);
  if (error !== undefined) return <Text role="alert">{error.message}</Text>;
  const visibleRequests =
    extensionId === undefined
      ? requests
      : requests.filter((request) => request.id === extensionId);
  if (visibleRequests.length === 0) return;
  return (
    <div className={requestList}>
      <Flex column gap={4} p={4}>
        {visibleRequests.map((request) => (
          <ExtensionPermissionCard key={request.id} request={request} />
        ))}
      </Flex>
    </div>
  );
}

function ExtensionPermissionCard({
  request,
}: {
  request: ExtensionPermissionRequest;
}) {
  const api = useApi();
  const card = useStyles(permissionCard);
  const decide = useMutation({
    mutationFn: (input: Parameters<typeof api.extensions.tools.decide>[0]) =>
      api.extensions.tools.decide(input),
    onError: (cause) =>
      console.warn("Extension permission decision failed:", cause),
  });
  return (
    <section
      aria-label={`Permissions for ${request.displayName}`}
      className={card}
    >
      <Flex column gap={6} p={6}>
        <Flex column gap={1}>
          <Text size="md" fontWeight={600}>
            Permissions
          </Text>
          <Text size="sm" color="lowContrast">
            {request.displayName} wants to use these tools:
          </Text>
        </Flex>
        <Flex column gap={2}>
          {request.paths.map((path) => (
            <Text key={path} size="sm" monospace>
              {path}
            </Text>
          ))}
        </Flex>
        <Flex row gap={2}>
          <Button
            variant="primary"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ ...request, action: "allow" })}
          >
            Allow access
          </Button>
          <Button
            variant="quiet"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ ...request, action: "deny" })}
          >
            Not now
          </Button>
        </Flex>
        {decide.error === null ? undefined : (
          <Text role="alert">{decide.error.message}</Text>
        )}
      </Flex>
    </section>
  );
}

const permissionRequests = style({
  flexShrink: 0,
  maxHeight: "40vh",
  overflowY: "auto",
});

const permissionCard = style(background.element, radius.lg, shadow.subtle, {
  width: "100%",
  maxWidth: "400px",
  overflowWrap: "anywhere",
});

export function ExtensionPermissionsButton({
  id,
  displayName,
}: {
  id: string;
  displayName: string;
}) {
  const [open, setOpen] = useState(false);
  const api = useApi();
  const queryClient = useQueryClient();
  const permissions = useQuery({
    queryKey: [...permissionsKey, id],
    queryFn: () => api.extensions.tools.check({ id }),
    enabled: open,
  });
  const revoke = useMutation({
    mutationFn: (path: string) =>
      api.extensions.tools.decide({ id, paths: [path], action: "revoke" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: permissionsKey }),
    onError: (cause) =>
      console.warn("Extension permission revocation failed:", cause),
  });
  return (
    <>
      <Tooltip content="Permissions">
        <Button
          variant="quiet"
          aria-label="Permissions"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Shield size="sm" />
        </Button>
      </Tooltip>
      {open ? (
        <Dialog onClickOutside={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Permissions for ${displayName}`}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
          >
            <Flex column gap={6}>
              <H2>Permissions</H2>
              <Text color="lowContrast">{displayName}</Text>
              {permissions.isPending ? (
                <Text role="status">Loading permissions…</Text>
              ) : undefined}
              {permissions.isError ? (
                <Text role="alert">{permissions.error.message}</Text>
              ) : undefined}
              {permissions.data?.granted.length === 0 ? (
                <Text>This extension has no tool access.</Text>
              ) : undefined}
              {permissions.data?.granted.map((path) => (
                <Flex row gap={4} key={path}>
                  <Text monospace>{path}</Text>
                  <Button
                    variant="quiet"
                    disabled={revoke.isPending}
                    aria-label={`Revoke ${path}`}
                    onClick={() => revoke.mutate(path)}
                  >
                    Revoke
                  </Button>
                </Flex>
              ))}
              {revoke.error === null ? undefined : (
                <Text role="alert">{revoke.error.message}</Text>
              )}
              <Button variant="quiet" onClick={() => setOpen(false)}>
                Done
              </Button>
            </Flex>
          </section>
        </Dialog>
      ) : undefined}
    </>
  );
}
