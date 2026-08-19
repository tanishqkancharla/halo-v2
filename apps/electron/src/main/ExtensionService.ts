import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import * as watcher from "@parcel/watcher";
import type {
  ExtensionBundle,
  ExtensionLoadError,
} from "../shared/extension.ts";
import {
  calendarExtensionSource,
  haloExtensionSkillMarkdown,
} from "./bundledExtensions.ts";
import { compileExtensionDirectory } from "./compileExtension.ts";
import {
  WorkspaceIoError,
  type WorkspaceLayout,
  type WorkspaceService,
} from "./workspace-service.ts";

export function workspaceExtensionsDir(workspaceRoot: string) {
  return join(workspaceRoot, ".halo", "extensions");
}

export function workspaceExtensionSkillFile(agentDir: string) {
  return join(agentDir, "skills", "halo-extension", "SKILL.md");
}

export class ExtensionService {
  private watchSubscription: watcher.AsyncSubscription | undefined;
  private watchedRoot: string | undefined;
  private listener: ((bundle: ExtensionBundle) => void) | undefined;
  private reloadTimer: ReturnType<typeof setTimeout> | undefined;
  private bundle: ExtensionBundle = { extensions: [], errors: [] };

  constructor(private readonly workspace: WorkspaceService) {}

  setListener(listener: ((bundle: ExtensionBundle) => void) | undefined) {
    this.listener = listener;
  }

  async list() {
    const synced = await this.sync();
    if (synced instanceof Error) return synced;
    return this.bundle;
  }

  async sync() {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return layout;

    const seeded = await this.seed(layout);
    if (seeded instanceof Error) return seeded;

    if (this.watchedRoot !== layout.root) {
      await this.stopWatch();
      await this.startWatch(workspaceExtensionsDir(layout.root));
      this.watchedRoot = layout.root;
    }

    const compiled = await compileWorkspaceExtensions(layout.root);
    if (compiled instanceof Error) return compiled;
    this.bundle = compiled;
    this.emit();
    return compiled;
  }

  private async seed(layout: WorkspaceLayout) {
    const extensionsDir = workspaceExtensionsDir(layout.root);
    const calendarDir = join(extensionsDir, "calendar");
    const createdExtensions = await mkdir(calendarDir, {
      recursive: true,
      mode: 0o700,
    }).catch((e) => new WorkspaceIoError({ cause: e }));
    if (createdExtensions instanceof Error) return createdExtensions;

    const calendarEntry = join(calendarDir, "index.tsx");
    if (!existsSync(calendarEntry)) {
      const written = await writeFile(
        calendarEntry,
        calendarExtensionSource,
      ).catch((e) => new WorkspaceIoError({ cause: e }));
      if (written instanceof Error) return written;
    }

    const skillFile = workspaceExtensionSkillFile(layout.agentDir);
    const createdSkill = await mkdir(dirname(skillFile), {
      recursive: true,
      mode: 0o700,
    }).catch((e) => new WorkspaceIoError({ cause: e }));
    if (createdSkill instanceof Error) return createdSkill;

    if (!existsSync(skillFile)) {
      const written = await writeFile(
        skillFile,
        haloExtensionSkillMarkdown,
      ).catch((e) => new WorkspaceIoError({ cause: e }));
      if (written instanceof Error) return written;
    }
  }

  private async startWatch(directory: string) {
    const subscription = await watcher
      .subscribe(directory, (err) => {
        if (err !== null) {
          console.warn("Extension watch error:", err.message);
          return;
        }
        this.scheduleReload();
      })
      .catch((e) => new WorkspaceIoError({ cause: e }));
    if (subscription instanceof Error) {
      console.warn("Extension watch failed to start:", subscription.message);
      return;
    }
    this.watchSubscription = subscription;
  }

  private async stopWatch() {
    if (this.reloadTimer !== undefined) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = undefined;
    }
    const subscription = this.watchSubscription;
    this.watchSubscription = undefined;
    this.watchedRoot = undefined;
    if (subscription === undefined) return;
    const stopped = await subscription
      .unsubscribe()
      .catch((e) => new WorkspaceIoError({ cause: e }));
    if (stopped instanceof Error) {
      console.warn("Extension watch stop failed:", stopped.message);
    }
  }

  private scheduleReload() {
    // Parcel emits a burst of create/update events for one save.
    if (this.reloadTimer !== undefined) clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = undefined;
      void this.reload();
    }, 50);
  }

  private async reload() {
    const layout = this.workspace.getLayout();
    if (layout instanceof Error) return;
    const compiled = await compileWorkspaceExtensions(layout.root);
    if (compiled instanceof Error) {
      console.warn("Extension reload failed:", compiled.message);
      return;
    }
    this.bundle = compiled;
    this.emit();
  }

  private emit() {
    const listener = this.listener;
    if (listener === undefined) return;
    listener(this.bundle);
  }
}

export async function compileWorkspaceExtensions(workspaceRoot: string) {
  const extensionsDir = workspaceExtensionsDir(workspaceRoot);
  const entries = await readdir(extensionsDir, { withFileTypes: true }).catch(
    (e) => new WorkspaceIoError({ cause: e }),
  );
  if (entries instanceof Error) return entries;

  const directories = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .toSorted((left, right) => left.name.localeCompare(right.name));

  const extensions: ExtensionBundle["extensions"] = [];
  const errors: ExtensionLoadError[] = [];
  for (const entry of directories) {
    const compiled = await compileExtensionDirectory({
      id: entry.name,
      directory: join(extensionsDir, entry.name),
    });
    if (compiled instanceof Error) {
      errors.push({ id: entry.name, message: compiled.message });
      continue;
    }
    extensions.push(compiled);
  }
  return { extensions, errors };
}
