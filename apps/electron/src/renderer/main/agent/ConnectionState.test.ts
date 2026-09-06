import { describe, expect, test } from "vitest";
import type { ConnectionRequest } from "@get-halo/shared/connectionRequests";
import type { HaloConnectionEvent } from "@get-halo/shared/sessionLog";
import {
  applyConnectionEvent,
  applyConnectionFailure,
  idleConnectionState,
  type ConnectionState,
} from "./ConnectionState.js";

const request: ConnectionRequest = {
  client: "google",
  clientOwner: "org",
  owner: "user",
  connectionName: "default",
  integration: "google_drive",
  template: "google",
};

function connecting(
  overrides: Partial<{ connectionId: string; wasConnected: boolean }>,
): ConnectionState {
  return {
    status: "connecting",
    connectionId: overrides.connectionId ?? "c1",
    expiresAt: Date.now() + 60_000,
    wasConnected: overrides.wasConnected ?? true,
  };
}

function cancelledEvent(connectionId: string): HaloConnectionEvent {
  return {
    type: "halo.connection",
    connectionId,
    request,
    status: "cancelled",
  };
}

describe("applyConnectionFailure", () => {
  test("reverts a wasConnected starting state to connected", () => {
    const state: ConnectionState = {
      status: "starting",
      wasConnected: true,
    };
    expect(applyConnectionFailure(state)).toEqual({ status: "connected" });
  });

  test("reverts a wasConnected connecting state to connected", () => {
    const state = connecting({ wasConnected: true });
    expect(applyConnectionFailure(state)).toEqual({ status: "connected" });
  });

  test("drops a fresh starting state to idle", () => {
    const state: ConnectionState = {
      status: "starting",
      wasConnected: false,
    };
    expect(applyConnectionFailure(state)).toEqual(idleConnectionState);
  });

  test("drops a fresh connecting state to idle", () => {
    const state = connecting({ wasConnected: false });
    expect(applyConnectionFailure(state)).toEqual(idleConnectionState);
  });

  test("preserves an already-connected state (event-first ordering)", () => {
    const state: ConnectionState = { status: "connected" };
    expect(applyConnectionFailure(state)).toEqual({ status: "connected" });
  });

  test("preserves a cancelled state", () => {
    const state: ConnectionState = { status: "cancelled" };
    expect(applyConnectionFailure(state)).toEqual({ status: "cancelled" });
  });

  test("preserves an expired state", () => {
    const state: ConnectionState = { status: "expired" };
    expect(applyConnectionFailure(state)).toEqual({ status: "expired" });
  });

  test("drops undefined to idle", () => {
    expect(applyConnectionFailure(undefined)).toEqual(idleConnectionState);
  });

  test("drops an idle state to idle", () => {
    const state: ConnectionState = { status: "idle" };
    expect(applyConnectionFailure(state)).toEqual(idleConnectionState);
  });
});

describe("connect-error / cancelled-event race (order-independence)", () => {
  test("event-first ordering reaches connected", () => {
    const start = connecting({ wasConnected: true });
    const afterEvent = applyConnectionEvent(start, cancelledEvent("c1"));
    const terminal = applyConnectionFailure(afterEvent);
    expect(terminal).toEqual({ status: "connected" });
  });

  test("RPC-first ordering reaches connected", () => {
    const start = connecting({ wasConnected: true });
    const afterFailure = applyConnectionFailure(start);
    const terminal = applyConnectionEvent(afterFailure, cancelledEvent("c1"));
    expect(terminal).toEqual({ status: "connected" });
  });

  test("both orderings reach the same terminal state", () => {
    const start = connecting({ wasConnected: true });

    const eventFirst = applyConnectionFailure(
      applyConnectionEvent(start, cancelledEvent("c1")),
    );
    const rpcFirst = applyConnectionEvent(
      applyConnectionFailure(start),
      cancelledEvent("c1"),
    );
    expect(eventFirst).toEqual(rpcFirst);
    expect(eventFirst).toEqual({ status: "connected" });
  });

  test("event-first never drops a wasConnected card to idle", () => {
    const start = connecting({ wasConnected: true });
    const terminal = applyConnectionFailure(
      applyConnectionEvent(start, cancelledEvent("c1")),
    );
    expect(terminal.status).not.toBe("idle");
  });
});

describe("cross-path consistency on terminal states", () => {
  for (const status of ["connected", "cancelled", "expired"] as const) {
    test(`${status} is preserved by both applyConnectionFailure and applyConnectionEvent`, () => {
      const terminal: ConnectionState = { status };
      expect(applyConnectionFailure(terminal)).toEqual(terminal);
      expect(applyConnectionEvent(terminal, cancelledEvent("other"))).toEqual(
        terminal,
      );
    });
  }
});

describe("applyConnectionEvent (regression, unchanged by the fix)", () => {
  test("preserves non-connecting state", () => {
    const connected: ConnectionState = { status: "connected" };
    expect(applyConnectionEvent(connected, cancelledEvent("c1"))).toEqual(
      connected,
    );
  });

  test("returns idle for undefined state", () => {
    expect(applyConnectionEvent(undefined, cancelledEvent("c1"))).toEqual(
      idleConnectionState,
    );
  });

  test("ignores an event for a different connectionId", () => {
    const state = connecting({ connectionId: "c1", wasConnected: true });
    expect(applyConnectionEvent(state, cancelledEvent("c2"))).toEqual(state);
  });

  test("reverts wasConnected to connected on a non-connected event", () => {
    const state = connecting({ connectionId: "c1", wasConnected: true });
    expect(applyConnectionEvent(state, cancelledEvent("c1"))).toEqual({
      status: "connected",
    });
  });

  test("applies the event status when not wasConnected", () => {
    const state = connecting({ connectionId: "c1", wasConnected: false });
    expect(applyConnectionEvent(state, cancelledEvent("c1"))).toEqual({
      status: "cancelled",
    });
  });
});
