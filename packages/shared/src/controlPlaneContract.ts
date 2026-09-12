import { error, oc, type, type RouterContractClient } from "@orpc/contract";

export const controlPlaneProtocolVersion = 1 as const;

export type ControlPlaneSession = {
  session: {
    id: string;
    userId: string;
    expiresAt: string;
  };
  user: {
    id: string;
    email: string;
    name: string;
    image?: string;
  };
};

export type DesktopAuthSession = ControlPlaneSession & {
  token: string;
};

export const ControlPlaneRequestError = error("BAD_REQUEST", {
  message: "The control plane could not complete the request.",
  data: type<{ message: string }>(),
});

const publicProcedure = oc.errors({
  [ControlPlaneRequestError.code]: ControlPlaneRequestError,
});

export const controlPlaneContract = publicProcedure.router({
  server: {
    info: oc.output(
      type<{ protocolVersion: typeof controlPlaneProtocolVersion }>(),
    ),
  },
  auth: {
    start: publicProcedure
      .input(type<{ callback: string; state: string }>())
      .output(type<{ authorizationUrl: string }>()),
    exchange: publicProcedure
      .input(type<{ code: string }>())
      .output(type<DesktopAuthSession>()),
    session: publicProcedure.output(type<ControlPlaneSession | undefined>()),
  },
});

export type ControlPlaneClient = RouterContractClient<
  typeof controlPlaneContract
>;
