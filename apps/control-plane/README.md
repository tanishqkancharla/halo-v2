# Control plane

Halo's control plane. In development it listens on loopback port `8787` and
publishes `{appDataDir}/control-plane.json` with `{ origin }` (mode `0600`).
`GET /health` returns 200. Auth lives at `/api/auth/*` through Better Auth with
Google sign-in. Stopping the process closes HTTP and removes the origin file.

Run from the repository root:

```sh
pnpm --filter @get-halo/control-plane dev
pnpm --filter @get-halo/control-plane start
```

`dev` watches for source changes. Both stay running until interrupted. Application
data defaults to `<repo>/.halo`; set `HALO_USER_DATA` to use a different directory.
Pass a JSON configuration file as the first argument to choose `appDataDir`,
`port`, and `auth` explicitly.

Development reads `.env` from the repository root when that file exists, then
requires:

- `BETTER_AUTH_SECRET` (at least 32 characters)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Google Cloud Console redirect URI: `{origin}/api/auth/callback/google`. In
development that is `http://127.0.0.1:8787/api/auth/callback/google`.
