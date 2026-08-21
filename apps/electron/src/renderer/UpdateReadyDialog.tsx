import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Dialog, Flex, H3, P, flex } from "maui";
import { style, useStyles } from "purse-styles";
import { UPDATE_CHANNELS } from "../shared/channels.js";
import type { AppInfo } from "../shared/rpc.ts";
import {
  appInfoQueryKey,
  useInstallAppUpdateMutation,
} from "./api/ApiProvider.tsx";

export function UpdateReadyPrompt({ appInfo }: { appInfo?: AppInfo }) {
  const queryClient = useQueryClient();
  const install = useInstallAppUpdateMutation();
  const [dismissedVersion, setDismissedVersion] = useState<string>();

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data !== UPDATE_CHANNELS.prompt) return;
      setDismissedVersion(undefined);
      void queryClient.invalidateQueries({ queryKey: appInfoQueryKey });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [queryClient]);

  if (appInfo === undefined) return undefined;
  if (appInfo.update.state !== "downloaded") return undefined;
  const version = appInfo.update.version;
  if (version === dismissedVersion) return undefined;

  return (
    <UpdateReadyDialog
      version={version}
      onLater={() => setDismissedVersion(version)}
      onUpdate={() => install.mutate()}
    />
  );
}

export function UpdateReadyDialog(props: {
  version: string;
  onLater: () => void;
  onUpdate: () => void;
}) {
  const actions = useStyles(styles.actions);
  return (
    <Dialog onClickOutside={props.onLater}>
      <div data-testid="update-ready-dialog">
        <Flex column gap={8}>
          <Flex column gap={3}>
            <H3>Update ready</H3>
            <P>
              Halo {props.version} has been downloaded. Restart to install it.
            </P>
          </Flex>
          <div className={actions}>
            <Button
              variant="quiet"
              data-testid="update-ready-later"
              onClick={props.onLater}
            >
              Later
            </Button>
            <Button data-testid="update-ready-update" onClick={props.onUpdate}>
              Update
            </Button>
          </div>
        </Flex>
      </div>
    </Dialog>
  );
}

const styles = {
  actions: style(flex({ direction: "row", gap: 3, justify: "end" }), {
    width: "100%",
  }),
};
