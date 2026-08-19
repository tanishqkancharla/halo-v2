import { useEffect, useState } from "react";
import { File } from "@pierre/diffs/react";
import { useTheme } from "maui";
import { radius, shadow } from "maui";
import { style, useStyles } from "purse-styles";
import { diffsTheme } from "./diffsTheme.ts";

type FileExcerptPayload = {
  path: string;
  start: number;
  end: number;
  contents: string;
};

export function FileExcerpt(props: {
  path: string;
  start: number;
  end: number;
  fallback: string;
}) {
  const { resolvedTheme } = useTheme();
  const shell = useStyles(styles.shell);
  const excerpt = useFileExcerpt(props);

  return (
    <div
      className={shell}
      data-file-path={props.path}
      data-walkthrough-kind="file"
    >
      <File
        file={{
          name: props.path,
          contents: excerpt === undefined ? props.fallback : excerpt.contents,
        }}
        disableWorkerPool
        options={{
          theme: diffsTheme,
          themeType: resolvedTheme,
          overflow: "wrap",
          renderHeaderMetadata: () => {
            const range = document.createElement("span");
            range.textContent = `${props.start}–${props.end}`;
            return range;
          },
        }}
      />
    </div>
  );
}

function useFileExcerpt(input: { path: string; start: number; end: number }) {
  const [excerpt, setExcerpt] = useState<FileExcerptPayload>();
  useEffect(() => {
    const params = new URLSearchParams({
      path: input.path,
      start: String(input.start),
      end: String(input.end),
    });
    void fetch(`/__walkthrough/file?${params.toString()}`)
      .then((response) => response.json())
      .then((value) => {
        // SAFETY: the walkthrough CLI serves FileExcerpt JSON for this route.
        setExcerpt(value as FileExcerptPayload);
      });
  }, [input.path, input.start, input.end]);
  return excerpt;
}

const styles = {
  shell: style(radius.md, shadow.subtle, {
    overflow: "hidden",
    minWidth: 0,
  }),
};
