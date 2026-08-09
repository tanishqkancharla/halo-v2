import * as Cloudflare from "alchemy/Cloudflare";

// Physical name from the existing Alchemy deploy. Changing this creates a new bucket.
export const Releases = Cloudflare.R2.Bucket("Releases", {
  name: "halo-releases-dev-ubuntu-auuzjrvkmjn3x2oy",
});
