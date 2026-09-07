import { text } from "maui";
import { style, useStyles } from "purse-styles";
import type { AutosaveStatus } from "./useAutosaveFile.ts";

const errorClass = style(text({ size: "sm", color: "lowContrast" }), {
  color: "light-dark(#b42318, #ff9592)",
});

export function AutosaveStatusIndicator({
  status,
}: {
  status: AutosaveStatus;
}) {
  const className = useStyles(errorClass);
  if (status.status !== "error") return undefined;
  return (
    <div className={className} role="alert" data-testid="autosave-error">
      {status.error.message}
    </div>
  );
}
