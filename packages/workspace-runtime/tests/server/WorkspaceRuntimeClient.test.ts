import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceRuntimeClient } from "../../src/client/WorkspaceRuntimeClient.js";
import { WorkspaceServer } from "../../src/server/WorkspaceServer.js";
import { WorkspaceRuntimeService } from "../../src/server/WorkspaceRuntimeService.js";

const tempDirectories: string[] = [];

function createWorkspaceRoot(): string {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "tasks-dispatcher-server-"));

  tempDirectories.push(workspaceRoot);
  return workspaceRoot;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("WorkspaceRuntimeClient", () => {
  it("creates and fetches tasks through the HTTP runtime server", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const runtimeService = await WorkspaceRuntimeService.open(workspaceRoot);
    const workspaceServer = new WorkspaceServer(runtimeService);
    const port = await workspaceServer.listen();
    const client = new WorkspaceRuntimeClient(`http://127.0.0.1:${port}`);

    const created = await client.createTask({
      title: "Server-backed task",
      description: "Verify client-server flow",
      workflowId: "default-plan-work-review"
    });
    const updated = await client.updateTask(created.id, {
      title: "Updated server-backed task",
      description: "Verify update flow",
      workflowId: "default-plan-work-review"
    });
    const fetched = await client.getTask(created.id);
    const list = await client.listTasks();

    expect(await client.ping()).toBe("workspace-runtime-ready");
    expect(updated.title).toBe("Updated server-backed task");
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.title).toBe("Updated server-backed task");
    expect(list.some((task) => task.id === created.id)).toBe(true);

    await workspaceServer.close();
  });
});
