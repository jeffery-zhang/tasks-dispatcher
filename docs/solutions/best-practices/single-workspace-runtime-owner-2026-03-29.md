---
title: Single workspace runtime owner
date: 2026-03-29
category: best-practices
module: workspace-runtime
problem_type: best_practice
component: tooling
symptoms:
  - CLI and Electron can both attach to the same workspace
  - Scheduling ownership becomes ambiguous if each entrypoint starts its own runtime
  - Duplicate dispatch, divergent logs, or conflicting state updates become possible
root_cause: missing_workflow_step
resolution_type: workflow_improvement
severity: high
tags: [workspace-runtime, runtime-owner, launcher-lock, sse, local-http]
---

# Single workspace runtime owner

## Problem
This project lets both CLI and Electron operate on the same workspace task space. Without one explicit runtime owner per workspace, both entrypoints can race to schedule tasks, write logs, and mutate task state.

## Symptoms
- CLI and Electron both need access to the same task list and live events
- A second entrypoint can start while one runtime is already active
- Queue ownership, log broadcasting, and task state transitions can diverge if the runtime is duplicated

## What Didn't Work
- Treating CLI and Electron as independent apps with direct storage access would have duplicated scheduling logic and broken parity.
- Letting each entrypoint bootstrap its own in-process scheduler would have made duplicate dispatch and conflicting updates a matter of timing.

## Solution
Make one local runtime process the single owner of a workspace, and force every entrypoint to connect through it.

Key pieces:

```ts
export class RuntimeLauncher {
  async connect(): Promise<WorkspaceRuntimeClient> {
    const existing = await this.#loadHealthyClient();
    if (existing) return existing;

    const release = await RuntimeLock.acquire(this.#paths.runtimeRoot);
    try {
      const rechecked = await this.#loadHealthyClient();
      if (rechecked) return rechecked;

      await this.#spawnRuntimeProcess();
      return await this.#waitForClient();
    } finally {
      release();
    }
  }
}
```

```ts
export class RuntimeLock {
  static async acquire(runtimeRoot: string): Promise<() => void> {
    const lockPath = resolve(runtimeRoot, "launcher.lock");
    mkdirSync(lockPath);
    return () => rmSync(lockPath, { recursive: true, force: true });
  }
}
```

Runtime metadata is written to `.tasks-dispatcher/runtime/runtime.json`, so later clients can discover the existing owner instead of spawning another one.

Idle shutdown is also part of the ownership contract:

```ts
if (
  workspaceServer.activeExecutionCount === 0 &&
  workspaceServer.activeClientCount === 0 &&
  workspaceServer.idleForMs >= 5_000
) {
  void shutdown();
}
```

This keeps the runtime single-owner and reusable, but not permanently resident.

## Why This Works
The project has one shared task space per workspace, so it also needs one shared runtime authority per workspace. `RuntimeLauncher` handles discovery and startup, `RuntimeLock` prevents concurrent bootstrap, and runtime metadata gives later clients a stable rendezvous point. Once all writes and scheduling pass through that one process, CLI and Electron stop being competing owners and become clients.

## Prevention
- Never let CLI or Electron write directly to SQLite or start their own scheduler.
- Keep runtime discovery and startup in one place: `RuntimeLauncher`.
- Treat `.tasks-dispatcher/runtime/runtime.json` as the only source of truth for an active workspace runtime.
- Keep an idle timeout, but only shut down when both conditions are true:
  - no active clients
  - no active executions
- Add or preserve tests that prove:
  - two clients see one task space
  - one workspace does not start two owners
  - a second client can attach to an already-running runtime

## Related Issues
- None yet. This is the first documented runtime ownership pattern for the repo.

