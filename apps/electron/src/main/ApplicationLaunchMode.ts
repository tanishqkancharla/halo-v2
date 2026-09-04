declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;

export enum ApplicationLaunchMode {
  Development = "development",
  Production = "production",
  Test = "test",
}

const hasDevServer = Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL);

export const applicationLaunchMode =
  process.env.HALO_E2E === "1"
    ? ApplicationLaunchMode.Test
    : hasDevServer
      ? ApplicationLaunchMode.Development
      : ApplicationLaunchMode.Production;
