import { existsSync, rmSync } from "node:fs";
import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams
} from "node:child_process";
import { AttemptResultFileStore } from "../../persistence/AttemptResultFileStore.js";
import {
  WRAPPER_ABORT_EXIT_CODE,
  type AgentAttemptWrapperLaunchPayload
} from "./AgentAttemptWrapperProtocol.js";

function readPayloadFromStdin(): Promise<AgentAttemptWrapperLaunchPayload> {
  return new Promise((resolve, reject) => {
    let body = "";

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      body += chunk;
    });
    process.stdin.on("end", () => {
      try {
        resolve(JSON.parse(body) as AgentAttemptWrapperLaunchPayload);
      } catch (error) {
        reject(error);
      }
    });
    process.stdin.on("error", reject);
  });
}

function spawnTargetProcess(
  payload: AgentAttemptWrapperLaunchPayload
): ChildProcessWithoutNullStreams {
  const target = payload.target;

  const childProcess =
    process.platform === "win32" && target.command === "codex"
      ? spawn("cmd.exe", ["/d", "/s", "/c", "codex.cmd", ...target.args], {
          cwd: payload.workspaceRoot,
          detached: false,
          shell: false,
          stdio: "pipe"
        })
      : spawn(target.command, target.args, {
          cwd: payload.workspaceRoot,
          detached: process.platform !== "win32",
          shell: false,
          stdio: "pipe"
        });

  if (target.stdinText) {
    childProcess.stdin.write(target.stdinText);
  }

  childProcess.stdin.end();
  return childProcess;
}

function waitForChildExit(
  childProcess: ChildProcessWithoutNullStreams
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve) => {
    childProcess.on("close", (code, signal) => {
      resolve({ code, signal });
    });
  });
}

async function waitForCloseWithin(
  childExit: Promise<{ code: number | null; signal: NodeJS.Signals | null }>,
  timeoutMs: number
): Promise<boolean> {
  return await Promise.race([
    childExit.then(() => true),
    new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), timeoutMs);
    })
  ]);
}

async function terminateChildTree(
  childProcess: ChildProcessWithoutNullStreams,
  childExit: Promise<{ code: number | null; signal: NodeJS.Signals | null }>
): Promise<boolean> {
  if (childProcess.pid === undefined) {
    return false;
  }

  try {
    if (process.platform === "win32") {
      spawnSync(
        "taskkill",
        ["/pid", String(childProcess.pid), "/t", "/f"],
        { stdio: "ignore" }
      );
    } else {
      process.kill(-childProcess.pid, "SIGTERM");
    }
  } catch {
    return childProcess.exitCode !== null || childProcess.signalCode !== null;
  }

  if (await waitForCloseWithin(childExit, 5_000)) {
    return true;
  }

  try {
    if (process.platform === "win32") {
      spawnSync(
        "taskkill",
        ["/pid", String(childProcess.pid), "/t", "/f"],
        { stdio: "ignore" }
      );
    } else {
      process.kill(-childProcess.pid, "SIGKILL");
    }
  } catch {}

  return await waitForCloseWithin(childExit, 2_000);
}

async function main(): Promise<void> {
  const payload = await readPayloadFromStdin();
  const childProcess = spawnTargetProcess(payload);
  const childExit = waitForChildExit(childProcess);
  let abortRequested = false;
  let abortPollTimer: NodeJS.Timeout | null = null;

  childProcess.stdout.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
  });
  childProcess.stderr.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
  });
  childProcess.on("error", (error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Unknown child process error."}\n`
    );
    process.exit(1);
  });

  const handleAbortSignal = async () => {
    if (abortRequested) {
      return;
    }

    abortRequested = true;
    if (abortPollTimer) {
      clearInterval(abortPollTimer);
      abortPollTimer = null;
    }
    const stopped = await terminateChildTree(childProcess, childExit);
    rmSync(payload.abortSignalPath, { force: true });
    if (stopped) {
      process.stdout.write("TASKS_DISPATCHER_ABORT_CONFIRMED\n");
    }
    process.exit(stopped ? WRAPPER_ABORT_EXIT_CODE : 1);
  };

  process.on("SIGTERM", () => {
    void handleAbortSignal();
  });
  process.on("SIGINT", () => {
    void handleAbortSignal();
  });
  abortPollTimer = setInterval(() => {
    if (existsSync(payload.abortSignalPath)) {
      void handleAbortSignal();
    }
  }, 100);

  if (typeof abortPollTimer.unref === "function") {
    abortPollTimer.unref();
  }

  const { code } = await childExit;

  if (abortRequested) {
    return;
  }

  if (abortPollTimer) {
    clearInterval(abortPollTimer);
  }
  rmSync(payload.abortSignalPath, { force: true });

  if (code === 0) {
    AttemptResultFileStore.writeAtomic(
      payload.resultPaths,
      AttemptResultFileStore.createSuccessResult({
        taskId: payload.taskId,
        attemptId: payload.attemptId
      })
    );
    process.exit(0);
  }

  process.exit(code ?? 1);
}

void main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Unknown wrapper error."}\n`
  );
  process.exit(1);
});
