import type { SystemApi } from "./api/SystemApi.js";

declare global {
  interface Window {
    halo: SystemApi;
  }
}
