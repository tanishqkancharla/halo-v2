import * as Cloudflare from "alchemy/Cloudflare";

export const Releases = Cloudflare.R2.Bucket("Releases", {
  name: "halo-releases",
});
