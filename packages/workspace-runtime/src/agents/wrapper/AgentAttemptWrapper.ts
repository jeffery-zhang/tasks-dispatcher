import { existsSync, rmSync } from "node:fs";
import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams
} from "node:child_process";
import { AttemptResultFileStore } from "../../persistence/AttemptResultFileStore.js";
import {
  ATTEMPT_RESULT_SCHEMA_VERSION,
  WRAPPER_ABORT_EXIT_CODE,
  WRAPPER_RESULT_PREFIX,
  type AgentAttemptWrapperLaunchPayload,
  type AttemptResult
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

function tryParseAttemptResultLine(
  line: string,
  payload: AgentAttemptWrapperLaunchPayload
): AttemptResult | null {
  const normalizedLine = line.trim();

  if (!normalizedLine.startsWith(WRAPPER_RESULT_PREFIX)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      normalizedLine.slice(WRAPPER_RESULT_PREFIX.length)
    ) as Partial<AttemptResult>;
    const hydrated: Partial<AttemptResult> = {
      schemaVersion: ATTEMPT_RESULT_SCHEMA_VERSION,
      taskId: payload.taskId,
      attemptId: payload.attemptId,
      stepKey: payload.stepKey,
      ...parsed
    };

    return AttemptResultFileStore.isValid(hydrated, {
      taskId: payload.taskId,
      attemptId: payload.attemptId,
      stepKey: payload.stepKey
    })
      ? hydrated
      : null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const payload = await readPayloadFromStdin();
  const childProcess = spawnTargetProcess(payload);
  const childExit = waitForChildExit(childProcess);
  let abortRequested = false;
  let abortPollTimer: NodeJS.Timeout | null = null;
  let stdoutBuffer = "";
  let attemptResult: AttemptResult | null = null;
  let wrapperExitInitiated = false;

  const clearAbortWatch = () => {
    if (abortPollTimer) {
      clearInterval(abortPollTimer);
      abortPollTimer = null;
    }

    rmSync(payload.abortSignalPath, { force: true });
  };

  const finalizeFromAttemptResult = async (result: AttemptResult) => {
    if (wrapperExitInitiated || abortRequested) {
      return;
    }

    wrapperExitInitiated = true;

    try {
      AttemptResultFileStore.writeAtomic(payload.resultPaths, result);
    } catch (error) {
      process.stderr.write(
        `${error instanceof Error ? error.message : "Failed to persist attempt result."}\n`
      );
      clearAbortWatch();
      process.exit(1);
      return;
    }

    clearAbortWatch();

    if (!(await waitForCloseWithin(childExit, 250))) {
      await terminateChildTree(childProcess, childExit);
    }

    process.exit(0);
  };

  const handleParsedAttemptResult = (parsed: AttemptResult | null) => {
    if (!parsed || attemptResult) {
      return;
    }

    attemptResult = parsed;
    void finalizeFromAttemptResult(parsed);
  };

  childProcess.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");

    process.stdout.write(text);
    stdoutBuffer += text;

    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";

    for (const line of lines) {
      handleParsedAttemptResult(tryParseAttemptResultLine(line, payload));
    }

    handleParsedAttemptResult(tryParseAttemptResultLine(stdoutBuffer, payload));
  });
  childProcess.stderr.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
  });
  childProcess.on("error", (error) => {
    if (wrapperExitInitiated) {
      return;
    }

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
    clearAbortWatch();
    const stopped = await terminateChildTree(childProcess, childExit);
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

  if (abortRequested || wrapperExitInitiated) {
    return;
  }

  if (stdoutBuffer) {
    handleParsedAttemptResult(tryParseAttemptResultLine(stdoutBuffer, payload));

    if (wrapperExitInitiated) {
      return;
    }
  }

  clearAbortWatch();

  if (code === 0 && attemptResult) {
    AttemptResultFileStore.writeAtomic(payload.resultPaths, attemptResult);
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
