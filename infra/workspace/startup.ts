export function workspaceStartup(ctx: { image: string; registry: string }) {
  return `#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null; then
  apt-get update
  apt-get install -y docker.io curl jq
fi
systemctl enable --now docker

disk=/dev/disk/by-id/google-halo-workspace
# GCP attaches new disks without a filesystem; never reformat an existing workspace.
if ! blkid "$disk" >/dev/null; then
  mkfs.ext4 -F "$disk"
fi
mkdir -p /mnt/halo
cat > /etc/systemd/system/mnt-halo.mount <<'MOUNT'
[Unit]
Description=Halo persistent workspace disk
[Mount]
What=/dev/disk/by-id/google-halo-workspace
Where=/mnt/halo
Type=ext4
[Install]
WantedBy=multi-user.target
MOUNT
systemctl daemon-reload
systemctl enable --now mnt-halo.mount
mkdir -p /mnt/halo/workspace
chown 1000:1000 /mnt/halo/workspace

cat > /etc/systemd/system/halo.service <<'SERVICE'
[Unit]
Description=Halo workspace server
Requires=docker.service mnt-halo.mount
After=docker.service mnt-halo.mount network-online.target
Wants=network-online.target
[Service]
Restart=on-failure
RestartSec=5
TimeoutStartSec=600
TimeoutStopSec=45
ExecStartPre=/bin/sh -c 'curl -fsS -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token | jq -r .access_token | docker login --username oauth2accesstoken --password-stdin https://${ctx.registry}'
ExecStartPre=/usr/bin/docker pull ${ctx.image}
ExecStart=/usr/bin/docker run --rm --name halo-workspace --network host --init --shm-size=1g --volume /mnt/halo/workspace:/workspace ${ctx.image}
ExecStop=/usr/bin/docker stop --time 30 halo-workspace
[Install]
WantedBy=multi-user.target
SERVICE
systemctl daemon-reload
systemctl enable halo
systemctl restart halo
`;
}
