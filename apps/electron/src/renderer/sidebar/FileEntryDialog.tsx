import { useState } from "react";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import {
  Button,
  Select,
  SelectItem,
  TextField,
  backgroundColor,
  flex,
  radius,
  shadow,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";

export type FileEntryAction =
  | { kind: "file"; parent: string }
  | { kind: "directory"; parent: string }
  | { kind: "rename"; path: string; isDirectory: boolean }
  | { kind: "move"; path: string; isDirectory: boolean };

export function FileEntryDialog({
  action,
  folders,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  action: FileEntryAction;
  folders: string[];
  pending: boolean;
  error: string | undefined;
  onSubmit(path: string): void;
  onClose(): void;
}) {
  const existing = action.kind === "rename" || action.kind === "move";
  const originalName = existing
    ? action.path.slice(action.path.lastIndexOf("/") + 1)
    : action.kind === "file"
      ? "Untitled.md"
      : "Untitled folder";
  const [name, setName] = useState(originalName);
  const [folder, setFolder] = useState(
    existing
      ? action.path.slice(0, Math.max(0, action.path.lastIndexOf("/")))
      : action.parent,
  );
  const overlay = useStyles(styles.overlay);
  const modal = useStyles(styles.modal);
  const form = useStyles(styles.form);
  const heading = useStyles(styles.heading);
  const label = useStyles(styles.label);
  const buttons = useStyles(styles.buttons);
  const errorClass = useStyles(styles.error);
  const title =
    action.kind === "file"
      ? "New file"
      : action.kind === "directory"
        ? "New folder"
        : action.kind === "rename"
          ? "Rename"
          : `Move ${originalName}`;
  const validName =
    name.trim().length > 0 &&
    !/[\\/]/.test(name) &&
    !name.startsWith(".") &&
    name !== "node_modules";
  const destination = folder === "" ? name.trim() : `${folder}/${name.trim()}`;
  const unchanged = existing && destination === action.path;
  const availableFolders = folders.filter(
    (path) =>
      !existing ||
      !action.isDirectory ||
      (path !== action.path && !path.startsWith(`${action.path}/`)),
  );

  return (
    <ModalOverlay
      isOpen
      isDismissable={!pending}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className={overlay}
    >
      <Modal className={modal}>
        <Dialog aria-label={title}>
          <form
            className={form}
            onSubmit={(event) => {
              event.preventDefault();
              if (validName && !unchanged && !pending) onSubmit(destination);
            }}
          >
            <h2 className={heading}>{title}</h2>
            {action.kind !== "move" && (
              <label className={label}>
                Name
                <TextField
                  aria-label="Name"
                  value={name}
                  onChange={setName}
                  autoFocus
                  isDisabled={pending}
                  onFocus={(event) => {
                    const input = event.target;
                    const dot = input.value.lastIndexOf(".");
                    input.setSelectionRange(
                      0,
                      dot > 0 ? dot : input.value.length,
                    );
                  }}
                />
              </label>
            )}
            {action.kind !== "rename" && (
              <Select
                label={action.kind === "move" ? "Move to" : "Location"}
                selectedKey={folder === "" ? "/" : folder}
                onSelectionChange={(key) => {
                  if (key === null) return;
                  setFolder(key === "/" ? "" : String(key));
                }}
                isDisabled={pending}
                autoFocus={action.kind === "move"}
              >
                {availableFolders.map((path) => (
                  <SelectItem key={path} id={path === "" ? "/" : path}>
                    {path === "" ? "Workspace" : path}
                  </SelectItem>
                ))}
              </Select>
            )}
            {error !== undefined && (
              <div role="alert" className={errorClass}>
                {error}
              </div>
            )}
            <div className={buttons}>
              <Button type="button" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!validName || unchanged || pending}
              >
                {pending
                  ? "Saving…"
                  : action.kind === "rename"
                    ? "Rename"
                    : action.kind === "move"
                      ? "Move"
                      : "Create"}
              </Button>
            </div>
          </form>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

export function FileMoveProgress() {
  const overlay = useStyles(styles.overlay);
  const modal = useStyles(styles.modal);
  return (
    <ModalOverlay isOpen className={overlay}>
      <Modal className={modal}>
        <Dialog aria-label="Moving files">
          <p role="status">Moving…</p>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

const styles = {
  overlay: style({
    position: "fixed",
    inset: 0,
    zIndex: 100,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    display: "grid",
    placeItems: "center",
    padding: "24px",
  }),
  modal: style(shadow.strong, radius.lg, spacing.padding({ all: 8 }), {
    width: "min(420px, 100%)",
    backgroundColor: backgroundColor.app,
    "& [role='dialog']": { outline: "none" },
  }),
  form: style(flex({ direction: "column", gap: 6 })),
  heading: style(text({ size: "md", fontWeight: 600 }), {
    margin: 0,
    overflowWrap: "anywhere",
  }),
  label: style(text({ size: "sm" }), flex({ direction: "column", gap: 2 })),
  buttons: style(flex({ justify: "end", gap: 3 }), {
    marginTop: spacing.value(2),
    "& button": { transition: "none" },
  }),
  error: style(text({ size: "sm" }), {
    color: "light-dark(#b42318, #ff9592)",
    overflowWrap: "anywhere",
  }),
};
