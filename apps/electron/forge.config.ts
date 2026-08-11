import type { ForgeConfig } from "@electron-forge/shared-types";

const appleApiKey = process.env.APPLE_API_KEY;
const appleApiKeyId = process.env.APPLE_API_KEY_ID;
const appleApiIssuer = process.env.APPLE_API_ISSUER;
const shouldNotarize =
  appleApiKey !== undefined &&
  appleApiKeyId !== undefined &&
  appleApiIssuer !== undefined;

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    appBundleId: "com.saffronhealth.halo",
    appCategoryType: "public.app-category.medical",
    icon: "icons/icon",
    name: "Halo",
    executableName: "Halo",
    extendInfo: {
      CFBundleName: "Halo",
      CFBundleDisplayName: "Halo",
    },
    osxSign: {},
    ...(shouldNotarize
      ? {
          osxNotarize: {
            appleApiKey,
            appleApiKeyId,
            appleApiIssuer,
          },
        }
      : {}),
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
      config: {
        options: {
          name: "halo",
          bin: "Halo",
          productName: "Halo",
        },
      },
    },
    {
      name: "@electron-forge/maker-rpm",
      platforms: ["linux"],
      config: {
        options: {
          name: "halo",
          bin: "Halo",
          productName: "Halo",
          license: "MIT",
        },
      },
    },
  ],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "tanishqkancharla",
          name: "halo-v2",
        },
        prerelease: false,
        draft: false,
        // Tag must equal package.json version (no "v" prefix).
        tagPrefix: "",
      },
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
            entry: "src/main/main.ts",
            config: "vite.main.config.ts",
          },
          {
            entry: "src/main/preload.ts",
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
