# Control plane

Halo's control plane. In development it listens on loopback port `8787`, uses
SQLite, and
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
Pass a JSON configuration file as the first argument to provide a configuration
that matches the `ControlPlaneConfig` schema in
`packages/config/src/controlPlane.ts` explicitly.

Development reads these secrets from GCP Secret Manager through Application
Default Credentials:

- `halo-dev-local-better-auth-secret`
- `halo-dev-control-plane-google-client-id`
- `halo-dev-control-plane-google-client-secret`

Google Cloud Console redirect URI: `{origin}/api/auth/callback/google`. In
development that is `http://127.0.0.1:8787/api/auth/callback/google`.

## Cloud Run

The production container listens on `0.0.0.0:$PORT`, uses PostgreSQL, and does
not publish a local discovery file. Cloud Run provides `K_SERVICE` and `PORT`;
configure these additional non-secret variables:

- `BETTER_AUTH_URL`: the service's generated `https://*.run.app` URL
- `DATABASE_URL_SECRET_ID`
- `BETTER_AUTH_SECRET_ID`
- `GOOGLE_CLIENT_ID_SECRET_ID`
- `GOOGLE_CLIENT_SECRET_ID`

The process calls GCP Secret Manager for each value at startup through its
attached service account.

Build `apps/control-plane/Dockerfile` from the repository root. The Google OAuth
redirect URI is `${BETTER_AUTH_URL}/api/auth/callback/google`.
