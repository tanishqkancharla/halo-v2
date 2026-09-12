import * as errore from "errore";
import { GoogleAuth } from "google-auth-library";

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

class ReadGcpSecretError extends errore.createTaggedError({
  name: "ReadGcpSecretError",
  message: "Could not read GCP secret $secretId: $detail",
}) {}

export async function readGcpSecret(ctx: {
  projectId: string;
  secretId: string;
}): Promise<string | Error> {
  const url = `https://secretmanager.googleapis.com/v1/projects/${encodeURIComponent(ctx.projectId)}/secrets/${encodeURIComponent(ctx.secretId)}/versions/latest:access`;
  const headers = await auth.getRequestHeaders(url).catch(
    (cause) =>
      new ReadGcpSecretError({
        secretId: ctx.secretId,
        detail: "authenticate request",
        cause,
      }),
  );
  if (headers instanceof Error) return headers;

  const response = await fetch(url, { headers }).catch(
    (cause) =>
      new ReadGcpSecretError({
        secretId: ctx.secretId,
        detail: "request latest version",
        cause,
      }),
  );
  if (response instanceof Error) return response;
  if (!response.ok)
    return new ReadGcpSecretError({
      secretId: ctx.secretId,
      detail: `request latest version: HTTP ${response.status}`,
    });

  const decoded = await response.json().catch(
    (cause) =>
      new ReadGcpSecretError({
        secretId: ctx.secretId,
        detail: "decode response",
        cause,
      }),
  );
  if (decoded instanceof Error) return decoded;

  // SAFETY: Secret Manager access responses encode payload bytes as base64 JSON text.
  const body = decoded as { payload?: { data?: string } };
  const data = body.payload?.data;
  if (data === undefined)
    return new ReadGcpSecretError({
      secretId: ctx.secretId,
      detail: "empty payload",
    });
  return Buffer.from(data, "base64").toString("utf8");
}
