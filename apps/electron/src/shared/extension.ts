export const extensionHostModules = [
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom",
  "maui",
  "purse-styles",
] as const;

export type ExtensionHostModuleName = (typeof extensionHostModules)[number];

export type SidebarItem = {
  id: string;
  label: string;
  viewId: string;
};

export type SidebarSection = {
  id: string;
  label: string;
  items: SidebarItem[];
};

export type CompiledExtension = {
  id: string;
  source: string;
};

export type ExtensionLoadError = {
  id: string;
  message: string;
};

export type ExtensionBundle = {
  extensions: CompiledExtension[];
  errors: ExtensionLoadError[];
};

export type ExtensionBundleHandler = (bundle: ExtensionBundle) => void;
