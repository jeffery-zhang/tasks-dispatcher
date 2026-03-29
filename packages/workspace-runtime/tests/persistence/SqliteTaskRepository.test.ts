import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Task } from "@tasks-dispatcher/core";
import { SqliteTaskRepository, WorkspaceStorage } from "../../src/index.js";

const tempDirectories: string[] = [];

function createWorkspaceRoot(): string {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "tasks-dispatcher-repo-"));

  tempDirectories.push(workspaceRoot);
  return workspaceRoot;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("SqliteTaskRepository", () => {
  it("saves and reloads tasks with attempts", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const storage = WorkspaceStorage.open(workspaceRoot);
    const repository = new SqliteTaskRepository(storage.database);
    const task = Task.createDraft({
      id: "task-1",
      title: "Implement persistence",
      description: "Store task state in sqlite",
      agent: "codex-cli",
      createdAt: new Date("2026-03-29T00:00:00.000Z")
    });

    task.queueForExecution({
      attemptId: "attempt-1",
      queuedAt: new Date("2026-03-29T00:01:00.000Z")
    });

    try {
      await repository.save(task);
      storage.close();

      const reopenedStorage = WorkspaceStorage.open(workspaceRoot);
      const reopenedRepository = new SqliteTaskRepository(reopenedStorage.database);
      const reloadedTask = await reopenedRepository.getById("task-1");

      expect(reloadedTask?.toSnapshot()).toMatchObject({
        id: "task-1",
        state: "pending_execution",
        currentAttemptId: "attempt-1"
      });
      expect(reloadedTask?.toSnapshot().attempts).toHaveLength(1);

      reopenedStorage.close();
    } finally {
      storage.close();
    }
  });

  it("returns separate task spaces for different workspace roots", async () => {
    const workspaceA = createWorkspaceRoot();
    const workspaceB = createWorkspaceRoot();
    const storageA = WorkspaceStorage.open(workspaceA);
    const storageB = WorkspaceStorage.open(workspaceB);
    const repositoryA = new SqliteTaskRepository(storageA.database);
    const repositoryB = new SqliteTaskRepository(storageB.database);

    try {
      await repositoryA.save(
        Task.createDraft({
          id: "task-a",
          title: "Only in A",
          description: "A workspace task",
          agent: "claude-code",
          createdAt: new Date("2026-03-29T00:00:00.000Z")
        })
      );

      expect(
        (await repositoryA.list()).map((task) => task.toSnapshot().id)
      ).toEqual(["task-a"]);
      expect(await repositoryB.list()).toHaveLength(0);
    } finally {
      storageA.close();
      storageB.close();
    }
  });
});
