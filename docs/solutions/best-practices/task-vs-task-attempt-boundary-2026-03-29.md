---
title: Separate task from task attempt
date: 2026-03-29
category: best-practices
module: core
problem_type: best_practice
component: service_object
symptoms:
  - Retry and failure history need to be preserved across multiple executions
  - Stage, termination reason, and timestamps change per execution rather than per task
  - Reopened and failed tasks can re-enter the queue without becoming new tasks
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [task-model, task-attempt, lifecycle, retry-history, domain-model]
---

# Separate task from task attempt

## Problem
This project supports failure, reopen, and repeated execution. A task is the long-lived business object, but each execution has its own stage, timestamps, logs, and termination outcome. Mixing those into one object destroys history.

## Symptoms
- A retry would overwrite the prior run's stage or failure cause
- A reopened task would blur "same task" versus "new execution"
- Logs and execution timestamps would stop lining up with the run they came from

## What Didn't Work
- Keeping only "current status" fields on `Task` would make retries clobber prior execution data.
- Treating retries as brand-new tasks would have broken the explicit reopen and validation flows in the product definition.

## Solution
Keep `Task` and `TaskAttempt` as separate domain objects.

`Task` owns long-lived business identity:
- title
- description
- selected agent
- workflow id/label
- lifecycle state

`TaskAttempt` owns per-run execution facts:
- queued/running/completed/failed
- current execution stage
- created/started/finished timestamps
- termination reason

The boundary is explicit in code:

```ts
export class Task {
  #state: TaskState;
  #currentAttemptId: string | null;
  readonly #attempts: TaskAttempt[];

  queueForExecution(input: QueueTaskInput): void {
    const attempt = TaskAttempt.createQueued({
      id: input.attemptId,
      taskId: this.#id,
      agent: this.#agent,
      createdAt: input.queuedAt
    });

    this.#attempts.push(attempt);
    this.#state = "pending_execution";
    this.#currentAttemptId = attempt.id;
  }
}
```

```ts
export class TaskAttempt {
  #status: TaskAttemptStatus;
  #stage: ExecutionStage;
  #terminationReason: TaskAttemptTerminationReason | null;
}
```

Persistence mirrors the same split:
- `tasks`
- `task_attempts`
- `task_events`

## Why This Works
The product lifecycle is task-level, but execution facts are attempt-level. Once those concepts are modeled separately, retries stop overwriting history, logs can be attached to one concrete run, and state transitions stay coherent even when a task fails and re-enters the queue.

## Prevention
- Never add per-run fields like `terminationReason`, `startedAt`, or `stage` directly onto `Task`.
- Any code that creates a new run must create a fresh `TaskAttempt`, not mutate the old one in place.
- Keep storage normalized in the same way the domain is normalized.
- Preserve tests that prove:
  - re-queueing creates a second attempt instead of overwriting the first
  - failed and reopened tasks keep historical attempts
  - the task lifecycle and attempt lifecycle remain distinct

## Related Issues
- None yet. This is the first documented domain-model boundary for task execution history.

