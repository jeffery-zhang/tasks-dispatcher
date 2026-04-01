---
title: Task lifecycle and workflow boundaries
date: 2026-04-01
category: best-practices
module: core
problem_type: best_practice
component: development_workflow
symptoms:
  - Task lifecycle, workflow selection, attempt history, and step execution semantics could drift apart
  - Old state names and top-level task agent fields forced runtime, CLI, and desktop to translate between conflicting truths
  - Without a frozen workflow snapshot, queued work could be reinterpreted after template changes
root_cause: logic_error
resolution_type: workflow_improvement
severity: high
tags: [task-lifecycle, workflow-snapshot, task-attempt, step-execution, state-machine, runtime-orchestration]
---

# Task lifecycle and workflow boundaries

## Problem
This refactor was not about renaming a few states. The real problem was that task lifecycle, workflow definition, attempt history, and machine execution protocol were starting to overlap, which would have made later features like multi-step workflows and per-step agents much harder to reason about.

## Symptoms
- The old model mixed task-level lifecycle with attempt-level execution facts.
- A task could have both a top-level `agent` and step-level execution intent, creating two possible sources of truth.
- `ready` did not yet mean "the execution contract is frozen and waiting to be claimed".
- Runtime, CLI, and desktop all had to keep translating old names and partial workflow semantics.

## What Didn't Work
- Keeping old lifecycle names such as `reopened`, `pending_execution`, and `pending_validation` would have continued to encode implementation history instead of stable product semantics.
- Treating workflow as only `workflowId / workflowLabel` without an attempt-specific snapshot would have let queued work drift when the template changed later.
- Reusing a single attempt-stage field for everything would have hidden the distinction between step definition and step runtime state.
- Letting task-level execution semantics survive alongside step-level execution semantics would have created dual truth about who actually runs the work.

## Solution
Capture the model as a set of hard boundaries and keep them stable across core, runtime, CLI, and desktop.

Key decisions:
- Use one lifecycle for tasks: `draft -> ready -> executing -> completed -> failed -> archived`.
- Treat `reopen` as an explicit action that sends a task back to `draft`, not as a separate lifecycle state.
- Allow editing only in `draft`.
- Require a task to hold an explicit `workflowId` while it is still in `draft`.
- Freeze the selected workflow into an attempt-specific snapshot when the task enters `ready`.
- Create a new queued attempt when the task enters `ready`, not when execution actually starts.
- Allow only one active attempt per task at a time.
- Keep execution ownership on workflow steps, not on the task itself.
- Separate step definitions from step runtime records.
- Model step progress with explicit runtime statuses like `pending`, `running`, `completed`, and `failed`, instead of collapsing everything into one stage field.
- Let runtime advance steps serially inside one attempt, rather than requiring humans to switch stages manually.
- Make machine protocol, not natural-language output, the source of truth for whether a step succeeded.
- For this version, forbid execution-time user Q&A and collapse any such path into a stable `needs_input` failure.

Two code-level consequences anchor the design:

```ts
// Task lifecycle is task-level truth.
export const TASK_STATES = [
  "draft",
  "ready",
  "executing",
  "completed",
  "failed",
  "archived"
] as const;
```

```ts
// Queueing creates the execution contract immediately.
queueForExecution(input: QueueTaskInput): void {
  const workflow = getTaskWorkflowDefinition(this.#workflowId);
  const attempt = TaskAttempt.createQueued({
    id: input.attemptId,
    taskId: this.#id,
    workflowId: workflow.id,
    workflowLabel: workflow.label,
    steps: workflow.steps,
    createdAt: input.queuedAt
  });

  this.#attempts.push(attempt);
  this.#state = "ready";
  this.#currentAttemptId = attempt.id;
}
```

## Why This Works
The model becomes explainable because each layer owns one kind of truth.

- `Task` owns lifecycle and user-editable identity.
- `TaskAttempt` owns one concrete execution contract and its history.
- Workflow templates define steps, but attempts preserve frozen snapshots.
- Runtime owns step progression and machine result validation.

Once those boundaries are explicit, `ready` becomes meaningful, retries stop mutating history, workflow template changes stop rewriting old runs, and every surface can describe the same task without inventing its own translation rules.

## Prevention
- Do not reintroduce task-level execution fields that duplicate step-level truth.
- Do not let a queued or executing task read live workflow template changes; only the frozen attempt snapshot should matter.
- Keep `reopen` as an event, not a state.
- Preserve the invariant that one task has at most one active attempt.
- Keep machine protocol and step-result validation as system-owned runtime boundaries, not workflow-editable behavior.
- Add or preserve tests for:
  - `draft -> ready -> executing -> completed|failed -> archived`
  - reopen creating a new attempt without mutating the old snapshot
  - workflow snapshot freezing on queue
  - runtime step progression staying serial and machine-validated
  - `needs_input` collapsing to a stable failed attempt and failed task

## Related Issues
- Related learning: `docs/solutions/best-practices/task-vs-task-attempt-boundary-2026-03-29.md`
- Related learning: `docs/solutions/best-practices/single-workspace-runtime-owner-2026-03-29.md`
- Related learning: `docs/solutions/integration-issues/windows-codex-process-launch-gotchas-2026-03-29.md`
- GitHub issue search was skipped as a durable input because `gh issue list` timed out in this environment.
