import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceSession } from "@tasks-dispatcher/core";
import {
  SqliteWorkspaceSessionStore,
  WorkspacePaths,
  WorkspaceStorage
} from "../../src/index.js";

const tempDirectories: string[] = [];

function createWorkspaceRoot(): string {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "tasks-dispatcher-workspace-"));

  tempDirectories.push(workspaceRoot);
  return workspaceRoot;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("WorkspaceStorage", () => {
  it("initializes the .tasks-dispatcher layout for a workspace", () => {
    const workspaceRoot = createWorkspaceRoot();
    const storage = WorkspaceStorage.open(workspaceRoot);
    const paths = new WorkspacePaths(workspaceRoot);

    expect(storage.paths.stateRoot).toBe(paths.stateRoot);
    expect(storage.paths.databasePath).toBe(paths.databasePath);
    expect(storage.paths.logsRoot).toBe(paths.logsRoot);
    expect(storage.paths.runtimeRoot).toBe(paths.runtimeRoot);

    storage.close();
  });

  it("persists and reloads the workspace session record", () => {
    const workspaceRoot = createWorkspaceRoot();
    const storage = WorkspaceStorage.open(workspaceRoot);
    const sessionStore = new SqliteWorkspaceSessionStore(storage.database);
    const session = new WorkspaceSession(
      workspaceRoot,
      new Date("2026-03-29T12:00:00.000Z")
    );

    sessionStore.save(session);
    storage.close();

    const reopenedStorage = WorkspaceStorage.open(workspaceRoot);
    const reopenedSessionStore = new SqliteWorkspaceSessionStore(
      reopenedStorage.database
    );

    expect(reopenedSessionStore.load()?.toSnapshot()).toEqual({
      workspacePath: workspaceRoot,
      openedAt: "2026-03-29T12:00:00.000Z"
    });

    reopenedStorage.close();
  });
});

