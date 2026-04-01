import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { AttemptResultFileStore } from "../../src/persistence/AttemptResultFileStore.js";

const tempDirectories: string[] = [];

function createWorkspaceRoot(): string {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "tasks-dispatcher-wrapper-"));

  tempDirectories.push(workspaceRoot);
  return workspaceRoot;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

function createWrapperLikeTargetScript(scriptPath: string): void {
  writeFileSync(
    scriptPath,
    [
      "const [mode] = process.argv.slice(2);",
      "if (mode === 'success') {",
      "  console.log('TASKS_DISPATCHER_RESULT:{\"status\":\"completed\",\"finishedAt\":\"2026-03-29T00:00:00.000Z\"}');",
      "  console.log('done');",
      "  process.exit(0);",
      "} else if (mode === 'abortable') {",
      "  console.log('waiting');",
      "  setInterval(() => {}, 1000);",
      "} else if (mode === 'success-no-newline-hangs') {",
      "  process.stdout.write('TASKS_DISPATCHER_RESULT:{\"status\":\"completed\",\"finishedAt\":\"2026-03-29T00:00:00.000Z\"}');",
      "  setInterval(() => {}, 1000);",
      "} else {",
      "  process.exit(1);",
      "}",
    ].join("\n"),
    "utf8"
  );
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

async function runWrapper(payload: object): Promise<{
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}> {
  const tsxCliPath = createRequire(import.meta.url).resolve("tsx/cli");
  const wrapperEntryPath = resolve(
    "packages/workspace-runtime/src/agents/wrapper/AgentAttemptWrapper.ts"
  );
  const child = spawn(process.execPath, [tsxCliPath, wrapperEntryPath], {
    cwd: process.cwd(),
    stdio: "pipe"
  });
  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });
  child.stdin.write(JSON.stringify(payload));
  child.stdin.end();

  return await new Promise((resolvePromise) => {
    child.on("close", (code, signal) => {
      resolvePromise({ code, signal, stdout, stderr });
    });
  });
}

describe("AgentAttemptWrapper", () => {
  it("writes a valid success result artifact and preserves child stdout", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const targetScriptPath = join(workspaceRoot, "target.mjs");
    const finalPath = join(workspaceRoot, "results", "task-1", "attempt-1.json");
    const tempPath = join(workspaceRoot, "results", "task-1", "attempt-1.tmp.json");

    createWrapperLikeTargetScript(targetScriptPath);

    const outcome = await runWrapper({
      workspaceRoot,
      taskId: "task-1",
      attemptId: "attempt-1",
      stepKey: "plan",
      resultPaths: { finalPath, tempPath },
      abortSignalPath: join(workspaceRoot, "abort", "task-1", "attempt-1.abort"),
      target: {
        command: process.execPath,
        args: [targetScriptPath, "success"]
      }
    });

    expect(outcome.code).toBe(0);
    expect(outcome.stdout).toContain("done");
    expect(
      AttemptResultFileStore.readFromPath(finalPath, {
        taskId: "task-1",
        attemptId: "attempt-1",
        stepKey: "plan"
      })
    ).toMatchObject({
      status: "completed",
      stepKey: "plan"
    });
  });

  it("finishes after a valid result even if the child keeps running without a trailing newline", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const targetScriptPath = join(workspaceRoot, "target.mjs");
    const finalPath = join(workspaceRoot, "results", "task-1", "attempt-1.json");
    const tempPath = join(workspaceRoot, "results", "task-1", "attempt-1.tmp.json");

    createWrapperLikeTargetScript(targetScriptPath);

    const outcome = await runWrapper({
      workspaceRoot,
      taskId: "task-1",
      attemptId: "attempt-1",
      stepKey: "review",
      resultPaths: { finalPath, tempPath },
      abortSignalPath: join(workspaceRoot, "abort", "task-1", "attempt-1.abort"),
      target: {
        command: process.execPath,
        args: [targetScriptPath, "success-no-newline-hangs"]
      }
    });

    expect(outcome.code).toBe(0);
    expect(
      AttemptResultFileStore.readFromPath(finalPath, {
        taskId: "task-1",
        attemptId: "attempt-1",
        stepKey: "review"
      })
    ).toMatchObject({
      status: "completed",
      stepKey: "review"
    });
  });

  it("confirms abort only after seeing the abort signal file and stopping the child", async () => {
    const workspaceRoot = createWorkspaceRoot();
    const targetScriptPath = join(workspaceRoot, "target.mjs");
    const abortSignalPath = join(
      workspaceRoot,
      "abort-signals",
      "task-1",
      "attempt-1.abort"
    );

    createWrapperLikeTargetScript(targetScriptPath);

    const wrapperPromise = runWrapper({
      workspaceRoot,
      taskId: "task-1",
      attemptId: "attempt-1",
      stepKey: "plan",
      resultPaths: {
        finalPath: join(workspaceRoot, "results", "task-1", "attempt-1.json"),
        tempPath: join(workspaceRoot, "results", "task-1", "attempt-1.tmp.json")
      },
      abortSignalPath,
      target: {
        command: process.execPath,
        args: [targetScriptPath, "abortable"]
      }
    });

    await wait(300);
    mkdirSync(join(workspaceRoot, "abort-signals", "task-1"), {
      recursive: true
    });
    writeFileSync(abortSignalPath, "abort", "utf8");

    const outcome = await wrapperPromise;

    expect(outcome.code).toBe(130);
    expect(outcome.stdout).toContain("TASKS_DISPATCHER_ABORT_CONFIRMED");
  });
});
