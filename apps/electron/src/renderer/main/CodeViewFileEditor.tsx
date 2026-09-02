import { useMemo, useState } from "react";
import { Editor, type EditorOptions } from "@pierre/diffs/edit";
import { CodeView, EditProvider, type CodeViewItem } from "@pierre/diffs/react";
import { monoFontFamily, useTheme } from "maui";
import { style, useStyles } from "purse-styles";
import { useAutosaveFile } from "./useAutosaveFile.ts";

const diffsTheme = {
  dark: "pierre-dark",
  light: "pierre-light",
} as const;

const pierreUnsafeCss = `:host { --diffs-font-family: ${monoFontFamily}; display: block; height: 100%; min-height: 100%; }`;

function createPierreEditor(options: EditorOptions<undefined>) {
  return new Editor(options);
}

export function CodeViewFileEditor({
  path,
  loaded,
}: {
  path: string;
  loaded: string;
}) {
  const { resolvedTheme } = useTheme();
  const autosave = useAutosaveFile({ path, loaded });
  const [initial] = useState(loaded);
  const host = useStyles(hostClass);

  const items = useMemo(
    (): CodeViewItem[] => [
      {
        type: "file",
        id: path,
        version: 1,
        edit: true,
        file: {
          name: path,
          contents: initial,
          cacheKey: path,
        },
      },
    ],
    [path, initial],
  );

  const options = useMemo(
    () => ({
      theme: diffsTheme,
      themeType: resolvedTheme,
      overflow: "scroll" as const,
      disableFileHeader: true,
      unsafeCSS: pierreUnsafeCss,
    }),
    [resolvedTheme],
  );

  return (
    <div className={host}>
      <EditProvider createEditor={createPierreEditor}>
        <CodeView
          items={items}
          options={options}
          disableWorkerPool
          onItemEditChange={(_item, file) => {
            autosave.onChange(file.contents);
          }}
          style={{ height: "100%", minHeight: "100%", width: "100%" }}
        />
      </EditProvider>
    </div>
  );
}

const hostClass = style({
  flex: "1 1 auto",
  minWidth: 0,
  minHeight: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  "& > div": {
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
  },
  "& > div > *": {
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
  },
  "& > div > div > div:has(diffs-container)": {
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: "100%",
    height: "100%",
  },
  "& diffs-container": {
    minHeight: "100%",
    height: "100%",
  },
});
