import type { ForgeConfig } from "@electron-forge/shared-types";

const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const releasesBucket = process.env.HALO_RELEASES_BUCKET;
const releaseFolder = process.env.npm_package_version;

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
  publishers: [
    {
      name: "@electron-forge/publisher-s3",
      config: {
        bucket: releasesBucket,
        endpoint:
          cloudflareAccountId === undefined
            ? undefined
            : `https://${cloudflareAccountId}.r2.cloudflarestorage.com`,
        region: "auto",
        // R2 rejects S3 object ACLs.
        omitAcl: true,
        folder: releaseFolder,
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
