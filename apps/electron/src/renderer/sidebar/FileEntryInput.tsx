import { useState } from "react";
import {
  NavigationTreeItem,
  NavigationTreeItemContent,
} from "react-aria-components/NavigationTree";
import { colors, flex, focusRing, spacing, text } from "maui";
import { File, Folder } from "maui/icons";
import { style, useStyles } from "purse-styles";

export type FileCreationAction =
  | { kind: "file"; parent: string }
  | { kind: "directory"; parent: string };

export function FileEntryInput({
  action,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  action: FileCreationAction;
  pending: boolean;
  error: string | undefined;
  onSubmit(path: string): void;
  onClose(): void;
}) {
  const [name, setName] = useState("");
  const value = name.trim();
  const invalid =
    /[\\/]/.test(value) || value.startsWith(".") || value === "node_modules";
  const label = action.kind === "file" ? "New file name" : "New folder name";
  const row = useStyles(styles.row);
  const input = useStyles(styles.input);
  const field = useStyles(styles.field);
  const feedback = useStyles(styles.feedback);
  const message =
    value === "node_modules"
      ? "This name is reserved."
      : invalid
        ? "Use a name without slashes or a leading dot."
        : error;
  return (
    <NavigationTreeItem
      id="new-workspace-entry"
      textValue={label}
      className={row}
    >
      <NavigationTreeItemContent>
        {action.kind === "file" ? <File size="sm" /> : <Folder size="sm" />}
        <div className={input}>
          <input
            className={field}
            aria-label={label}
            placeholder={
              action.kind === "file" ? "Filename.ext" : "Folder name"
            }
            value={name}
            autoFocus
            disabled={pending}
            aria-invalid={message !== undefined}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            onBlur={() => {
              if (pending || invalid) return;
              if (value === "") {
                onClose();
                return;
              }
              onSubmit(
                action.parent === "" ? value : `${action.parent}/${value}`,
              );
            }}
          />
          {message !== undefined && (
            <span role="alert" className={feedback}>
              {message}
            </span>
          )}
        </div>
      </NavigationTreeItemContent>
    </NavigationTreeItem>
  );
}

const styles = {
  row: style(
    flex({ align: "start", gap: 2 }),
    spacing.padding({ x: 4, y: 2 }),
    {
      paddingLeft: `calc(${spacing.value(4)} + (var(--tree-item-level, 1) - 1) * ${spacing.value(4)})`,
      minWidth: 0,
      "& > svg": {
        flexShrink: 0,
        marginTop: spacing.value(2),
        color: colors.gray[11],
      },
    },
  ),
  input: style({ flex: "1 1 auto", minWidth: 0 }),
  field: style(text({ size: "sm" }), focusRing(), {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: `${spacing.value(1)} ${spacing.value(2)}`,
    border: `1px solid ${colors.gray[8]}`,
    borderRadius: "3px",
    backgroundColor: colors.gray[2],
    color: colors.gray[12],
    outline: "none",
  }),
  feedback: style(text({ size: "xs" }), {
    display: "block",
    color: colors.red[11],
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  }),
};
