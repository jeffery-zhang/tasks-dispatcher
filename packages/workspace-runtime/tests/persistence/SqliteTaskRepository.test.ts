import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_WORKFLOW_ID, Task } from "@tasks-dispatcher/core";
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
  it("saves and reloads tasks with queued attempts and step records", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const storage = WorkspaceStorage.open(workspaceRoot);
    const repository = new SqliteTaskRepository(storage.database);
    const task = Task.createDraft({
      id: "task-1",
      title: "Implement persistence",
      description: "Store task state in sqlite",
      workflowId: DEFAULT_WORKFLOW_ID,
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
        state: "ready",
        currentAttemptId: "attempt-1"
      });
      expect(reloadedTask?.toSnapshot().attempts[0]).toMatchObject({
        status: "queued",
        workflowId: DEFAULT_WORKFLOW_ID,
        currentStepKey: null
      });
      expect(reloadedTask?.toSnapshot().attempts[0].steps).toHaveLength(3);

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
          workflowId: DEFAULT_WORKFLOW_ID,
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

  it("round-trips protocol_failure termination reasons", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const storage = WorkspaceStorage.open(workspaceRoot);
    const repository = new SqliteTaskRepository(storage.database);
    const task = Task.createDraft({
      id: "task-failure",
      title: "Protocol failure",
      description: "Persist protocol failure attempts",
      workflowId: DEFAULT_WORKFLOW_ID,
      createdAt: new Date("2026-03-29T00:00:00.000Z")
    });

    task.queueForExecution({
      attemptId: "attempt-failure",
      queuedAt: new Date("2026-03-29T00:01:00.000Z")
    });
    task.markExecuting(new Date("2026-03-29T00:02:00.000Z"));
    task.markExecutionFailed(
      "protocol_failure",
      new Date("2026-03-29T00:03:00.000Z")
    );

    try {
      await repository.save(task);
      const reloadedTask = await repository.getById("task-failure");

      expect(reloadedTask?.toSnapshot().attempts.at(-1)).toMatchObject({
        status: "failed",
        terminationReason: "protocol_failure"
      });
      expect(reloadedTask?.toSnapshot().attempts.at(-1)?.steps[0]).toMatchObject({
        status: "failed",
        failureReason: "protocol_failure"
      });
    } finally {
      storage.close();
    }
  });
});
