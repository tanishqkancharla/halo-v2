import type { ComponentType } from "react";
import type { IconProps } from "maui";
import {
  Cpu,
  CursorClick,
  Folder,
  Globe,
  Lightning,
  Plug,
  Route,
  Wifi,
} from "maui/icons";
import type { Carrier, ProcessName } from "../model/Program.js";

export const carrierIcons = {
  ui: CursorClick,
  ipc: Plug,
  rpc: Route,
  http: Globe,
  filesystem: Folder,
  process: Cpu,
  network: Wifi,
  memory: Lightning,
} satisfies Record<Carrier, ComponentType<IconProps>>;

export const processLabels = {
  renderer: "renderer",
  preload: "preload",
  main: "main",
  outside: "outside",
} satisfies Record<ProcessName, string>;
