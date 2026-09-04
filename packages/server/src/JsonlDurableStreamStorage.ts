import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import * as errore from "errore";
import type {
  DurableStreamRecord,
  DurableStreamStorage,
} from "./DurableStream.js";
import {
  FilesystemPathNotFoundError,
  type FilesystemService,
} from "./filesystem/FilesystemService.js";

export class JsonlDurableStreamReadError extends errore.createTaggedError({
  name: "JsonlDurableStreamReadError",
  message: "Could not read durable stream '$path'",
}) {}

export class JsonlDurableStreamRecordError extends errore.createTaggedError({
  name: "JsonlDurableStreamRecordError",
  message: "Invalid durable stream record at '$path' line $line",
}) {}

export class JsonlDurableStreamAppendError extends errore.createTaggedError({
  name: "JsonlDurableStreamAppendError",
  message: "Could not append durable stream '$path'",
}) {}

export class JsonlDurableStreamStorage<
  TValueSchema extends TSchema,
> implements DurableStreamStorage<Static<TValueSchema>> {
  private readonly recordSchema: TSchema;

  constructor(
    private readonly args: {
      filesystem: FilesystemService;
      path: string;
      valueSchema: TValueSchema;
    },
  ) {
    this.recordSchema = Type.Object({
      sequence: Type.Integer({ minimum: 1 }),
      value: args.valueSchema,
    });
  }

  async load(): Promise<
    readonly DurableStreamRecord<Static<TValueSchema>>[] | Error
  > {
    const contents = await this.args.filesystem.readFile(
      this.args.path,
      "utf8",
    );
    if (contents instanceof FilesystemPathNotFoundError) return [];
    if (contents instanceof Error) {
      return new JsonlDurableStreamReadError({
        path: this.args.path,
        cause: contents,
      });
    }

    const lines = contents.split("\n");
    if (lines.at(-1) === "") lines.pop();
    const records: DurableStreamRecord<Static<TValueSchema>>[] = [];
    for (const [index, line] of lines.entries()) {
      const lineNumber = index + 1;
      const parsed = errore.try({
        try: () => {
          // SAFETY: JSON.parse is untyped; recordSchema is the storage contract.
          return JSON.parse(line) as unknown;
        },
        catch: (cause) =>
          new JsonlDurableStreamRecordError({
            path: this.args.path,
            line: lineNumber,
            cause,
          }),
      });
      if (parsed instanceof Error) return parsed;
      if (!Value.Check(this.recordSchema, parsed)) {
        return new JsonlDurableStreamRecordError({
          path: this.args.path,
          line: lineNumber,
        });
      }
      // SAFETY: recordSchema validates the sequence and TValueSchema value.
      records.push(parsed as DurableStreamRecord<Static<TValueSchema>>);
    }
    return records;
  }

  async append(
    records: readonly DurableStreamRecord<Static<TValueSchema>>[],
  ): Promise<void | Error> {
    for (const record of records) {
      if (Value.Check(this.recordSchema, record)) continue;
      return new JsonlDurableStreamAppendError({ path: this.args.path });
    }
    const contents = errore.try({
      try: () =>
        `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
      catch: (cause) =>
        new JsonlDurableStreamAppendError({
          path: this.args.path,
          cause,
        }),
    });
    if (contents instanceof Error) return contents;
    const appended = await this.args.filesystem.appendFile(
      this.args.path,
      contents,
    );
    if (!(appended instanceof Error)) return;
    return new JsonlDurableStreamAppendError({
      path: this.args.path,
      cause: appended,
    });
  }
}
