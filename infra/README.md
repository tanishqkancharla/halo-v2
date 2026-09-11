# Halo infrastructure

New GCP infrastructure uses Pulumi with TypeScript in project `halo-relay`,
region `us-central1`. The existing Alchemy program still owns its Cloudflare
resources; bootstrapping Pulumi does not migrate them.

## Bootstrap Pulumi

Install the Google Cloud CLI and Pulumi CLI. Authenticate locally:

```sh
gcloud auth login --update-adc --project=halo-relay
```

From the repository root, create the backend prerequisites:

```sh
pnpm infra:bootstrap
pulumi login gs://halo-relay-pulumi-state
```

`bootstrap.sh` enables the required infrastructure APIs and creates a private,
versioned state bucket plus a Cloud KMS encryption key. It checks for existing
resources before creating them, so it can be rerun after an interrupted setup.
Google Cloud API activation can take a few minutes to propagate; if KMS still
reports that its API is disabled immediately after activation, rerun the script
once activation has propagated.
The deployment identity needs permission to enable services, manage the state
bucket, and create and use the KMS key. Workspace runtime identities must not
have access to this state or key.

| Setting          | Value                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------ |
| GCP project      | `halo-relay`                                                                               |
| Region           | `us-central1`                                                                              |
| State backend    | `gs://halo-relay-pulumi-state`                                                             |
| Secrets provider | `gcpkms://projects/halo-relay/locations/us-central1/keyRings/halo-pulumi/cryptoKeys/state` |

The bucket and key are bootstrap resources outside the application stacks.
Keep them available for the lifetime of those stacks: losing the key prevents
decryption of their Pulumi secrets.

## Infrastructure programs

The next implementation step is to add two Pulumi programs:

- `control-plane/`: shared network, image registry, and deployment permissions.
- `workspace/`: one workspace VM, persistent disk, and runtime service account.

When creating a stack in either program, select the KMS secrets provider:

```sh
pulumi stack init dev \
  --secrets-provider=gcpkms://projects/halo-relay/locations/us-central1/keyRings/halo-pulumi/cryptoKeys/state
pulumi config set gcp:project halo-relay
pulumi config set gcp:region us-central1
```

The Google credentials used by Pulumi are Application Default Credentials.
They are separate from the Google sign-in session that Halo users will use.

References: [GCP authentication](https://www.pulumi.com/registry/packages/gcp/installation-configuration/),
[GCS backends](https://www.pulumi.com/docs/iac/operations/stack-management/using-a-diy-backend/),
[KMS secrets](https://www.pulumi.com/docs/iac/concepts/secrets/#google-cloud-key-management-service-kms).
