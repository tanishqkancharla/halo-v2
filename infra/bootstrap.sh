#!/usr/bin/env bash
set -euo pipefail

project=halo-relay
region=us-central1
bucket="${project}-pulumi-state"
keyring=halo-pulumi
key=state

# The remote backend must exist before a Pulumi stack can use it.
gcloud services enable \
  cloudkms.googleapis.com \
  storage.googleapis.com \
  compute.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  iap.googleapis.com \
  --project="$project" --quiet

existing_bucket=$(gcloud storage buckets list \
  --project="$project" --filter="name=$bucket" --format='value(name)')
if [[ -z "$existing_bucket" ]]; then
  gcloud storage buckets create "gs://$bucket" \
    --project="$project" --location="$region" \
    --uniform-bucket-level-access --public-access-prevention
fi
gcloud storage buckets update "gs://$bucket" \
  --project="$project" --versioning \
  --uniform-bucket-level-access --public-access-prevention

keyring_resource="projects/$project/locations/$region/keyRings/$keyring"
existing_keyring=$(gcloud kms keyrings list \
  --project="$project" --location="$region" \
  --filter="name=$keyring_resource" --format='value(name)')
if [[ -z "$existing_keyring" ]]; then
  gcloud kms keyrings create "$keyring" \
    --project="$project" --location="$region"
fi

key_resource="$keyring_resource/cryptoKeys/$key"
existing_key=$(gcloud kms keys list \
  --project="$project" --location="$region" --keyring="$keyring" \
  --filter="name=$key_resource" --format='value(name)')
if [[ -z "$existing_key" ]]; then
  gcloud kms keys create "$key" \
    --project="$project" --location="$region" --keyring="$keyring" \
    --purpose=encryption
fi

printf 'Pulumi backend: gs://%s\nSecrets provider: gcpkms://%s\n' \
  "$bucket" "$key_resource"
