import type { ConnectionRequest } from "@get-halo/shared/connectionRequests";
import type { HaloConnectionEvent } from "@get-halo/shared/sessionLog";

export type ConnectionState =
  | { status: "idle" | "connected" | "cancelled" | "expired" }
  | { status: "starting"; wasConnected: boolean }
  | {
      status: "connecting";
      connectionId: string;
      expiresAt: number;
      wasConnected: boolean;
    };

export const idleConnectionState: ConnectionState = { status: "idle" };

export function connectionStateQueryKey(request: ConnectionRequest) {
  return [
    "executorConnection",
    request.integration,
    request.connectionName,
  ] as const;
}

export function applyConnectionEvent(
  state: ConnectionState | undefined,
  event: HaloConnectionEvent,
): ConnectionState {
  if (state?.status !== "connecting") return state ?? idleConnectionState;
  if (state.connectionId !== event.connectionId) return state;
  if (event.status !== "connected" && state.wasConnected) {
    return { status: "connected" };
  }
  return { status: event.status };
}

// Preserves a terminal state so the connect-error path is order-independent
// against a server `cancelled`/`expired` event applied first via the events
// stream. Mirrors the cancel/expiry/applyConnectionEvent sibling updaters.
export function applyConnectionFailure(
  state: ConnectionState | undefined,
): ConnectionState {
  if (
    (state?.status === "starting" || state?.status === "connecting") &&
    state.wasConnected
  ) {
    return { status: "connected" };
  }
  if (
    state?.status === "connected" ||
    state?.status === "cancelled" ||
    state?.status === "expired"
  ) {
    return state;
  }
  return idleConnectionState;
}
