import type { ForgeConfig } from "@electron-forge/shared-types";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    appBundleId: "com.saffronhealth.halo",
    appCategoryType: "public.app-category.medical",
    icon: "icons/icon",
    name: "Halo",
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      config: {
        name: "Halo",
        authors: "Saffron Health",
        description: "Halo desktop app",
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
      config: {},
    },
    {
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
      config: {},
    },
    {
      name: "@electron-forge/maker-deb",
      platforms: ["linux"],
      config: {},
    },
    {
      name: "@electron-forge/maker-rpm",
      platforms: ["linux"],
      config: {},
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    {
      name: "@electron-forge/plugin-vite",
      config: {
        build: [
          {
            entry: "electron/main.ts",
            config: "vite.main.config.ts",
          },
          {
            entry: "electron/preload.ts",
            config: "vite.preload.config.ts",
          },
        ],
        renderer: [
          {
            name: "main_window",
            config: "vite.renderer.config.ts",
          },
        ],
      },
    },
  ],
};

export default config;
