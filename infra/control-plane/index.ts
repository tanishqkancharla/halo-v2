/* oxlint-disable anti-slop/no-unused-exports, eslint/no-new -- Pulumi registers resources and stack outputs through module side effects. */
import * as gcp from "@pulumi/gcp";
import * as pulumi from "@pulumi/pulumi";

const configuration = new pulumi.Config("gcp");
const project = configuration.require("project");
const region = configuration.require("region");
const name = `halo-${pulumi.getStack()}`;

const network = new gcp.compute.Network("network", {
  name,
  autoCreateSubnetworks: false,
});
const subnet = new gcp.compute.Subnetwork("subnet", {
  name,
  network: network.id,
  region,
  ipCidrRange: "10.42.0.0/20",
  privateIpGoogleAccess: true,
});
const router = new gcp.compute.Router("router", {
  name: `${name}-router`,
  network: network.id,
  region,
});
new gcp.compute.RouterNat("nat", {
  name: `${name}-nat`,
  router: router.name,
  region,
  natIpAllocateOption: "AUTO_ONLY",
  sourceSubnetworkIpRangesToNat: "LIST_OF_SUBNETWORKS",
  subnetworks: [{ name: subnet.id, sourceIpRangesToNats: ["ALL_IP_RANGES"] }],
  logConfig: { enable: true, filter: "ERRORS_ONLY" },
});
new gcp.compute.Firewall("ssh", {
  name: `${name}-iap-ssh`,
  network: network.id,
  // Google IAP's TCP forwarding range; workspace HTTP ports stay private.
  sourceRanges: ["35.235.240.0/20"],
  targetTags: ["halo-workspace"],
  allows: [{ protocol: "tcp", ports: ["22"] }],
});

const repository = new gcp.artifactregistry.Repository("images", {
  repositoryId: `${name}-workspaces`,
  location: region,
  format: "DOCKER",
});
const sources = new gcp.storage.Bucket("build-sources", {
  name: `${project}-${name}-build-sources`,
  location: region,
  uniformBucketLevelAccess: true,
  publicAccessPrevention: "enforced",
  lifecycleRules: [{ action: { type: "Delete" }, condition: { age: 7 } }],
});
const builder = new gcp.serviceaccount.Account("builder", {
  accountId: `${name}-builder`,
  displayName: "Halo workspace image builder",
});
new gcp.artifactregistry.RepositoryIamMember("image-writer", {
  project,
  location: region,
  repository: repository.name,
  role: "roles/artifactregistry.writer",
  member: pulumi.interpolate`serviceAccount:${builder.email}`,
});
new gcp.storage.BucketIAMMember("source-reader", {
  bucket: sources.name,
  role: "roles/storage.objectViewer",
  member: pulumi.interpolate`serviceAccount:${builder.email}`,
});
new gcp.projects.IAMMember("build-logs", {
  project,
  role: "roles/logging.logWriter",
  member: pulumi.interpolate`serviceAccount:${builder.email}`,
});

export const networkId = network.id;
export const subnetId = subnet.id;
export const repositoryId = repository.name;
export const imageRepository = pulumi.interpolate`${region}-docker.pkg.dev/${project}/${repository.repositoryId}/workspace-server`;
export const buildSourceBucket = sources.name;
export const buildServiceAccount = builder.name;
