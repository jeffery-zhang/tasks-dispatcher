import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TaskLogFileStore, WorkspacePaths } from "../../src/index.js";

const tempDirectories: string[] = [];

function createWorkspaceRoot(): string {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "tasks-dispatcher-logs-"));

  tempDirectories.push(workspaceRoot);
  return workspaceRoot;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("TaskLogFileStore", () => {
  it("appends raw output and reads it back from the attempt log file", () => {
    const workspaceRoot = createWorkspaceRoot();
    const logStore = new TaskLogFileStore(new WorkspacePaths(workspaceRoot));

    logStore.append("task-1", "attempt-1", "line one\n");
    logStore.append("task-1", "attempt-1", "line two\n");

    expect(logStore.read("task-1", "attempt-1")).toBe("line one\nline two\n");
  });

  it("returns an empty string when the attempt log has not been created yet", () => {
    const workspaceRoot = createWorkspaceRoot();
    const logStore = new TaskLogFileStore(new WorkspacePaths(workspaceRoot));

    expect(logStore.read("task-missing", "attempt-missing")).toBe("");
  });
});
