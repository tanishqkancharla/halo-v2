export type SourceReference = {
  id: string;
  side: "old" | "new";
  start: number;
  end: number;
};

export type CallStackLine = {
  text: string;
  references: SourceReference[];
};

export function parseCallStack(source: string): CallStackLine[] {
  return source.split("\n").map((line) => {
    const references: SourceReference[] = [];
    const text = line.replace(
      /\s*\[\[([\w-]+):(old|new):([1-9]\d*)(?:-([1-9]\d*))?\]\]/g,
      (
        _match,
        id: string,
        side: "old" | "new",
        start: string,
        end: string | undefined,
      ) => {
        references.push({
          id,
          side,
          start: Number(start),
          end: Number(end === undefined ? start : end),
        });
        return "";
      },
    );
    return { text, references };
  });
}
