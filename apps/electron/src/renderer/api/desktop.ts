import type { DesktopApi } from "../../shared/desktop.js";

declare global {
  interface Window {
    haloDesktop: DesktopApi;
  }
}

export const desktopApi = window.haloDesktop;
