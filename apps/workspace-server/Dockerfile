FROM node:22-bookworm

ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
ENV HALO_USER_DATA=/workspace/.halo/runtime
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
WORKDIR /opt/halo

RUN npm install --global pnpm@12.1.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY packages ./packages
COPY apps/workspace-server ./apps/workspace-server
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @get-halo/extension-sdk build \
    && pnpm --filter @get-halo/extension-tools build \
    && pnpm exec playwright install --with-deps chromium --no-shell
# The workspace CLI builds and packs the local SDK when authoring extensions.
RUN chown -R node:node /opt/halo/packages

USER node
HEALTHCHECK --interval=30s --start-period=120s --timeout=15s \
    CMD node --import tsx packages/halo-cli/src/cli.ts status --json
ENTRYPOINT ["node", "--import", "tsx", "apps/workspace-server/src/main.ts"]
CMD ["apps/workspace-server/container.json"]
