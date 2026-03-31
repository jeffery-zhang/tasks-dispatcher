import type { TaskState } from "./TaskState.js";

const editableStates = new Set<TaskState>(["draft"]);
const queueableStates = new Set<TaskState>(["draft"]);
const reopenableStates = new Set<TaskState>(["completed", "failed"]);

export class TaskStateTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskStateTransitionError";
  }
}

export class TaskStateMachine {
  static canEdit(state: TaskState): boolean {
    return editableStates.has(state);
  }

  static assertCanEdit(state: TaskState): void {
    if (!TaskStateMachine.canEdit(state)) {
      throw new TaskStateTransitionError(
        `Task in state "${state}" cannot be edited.`
      );
    }
  }

  static assertCanQueue(state: TaskState): void {
    if (!queueableStates.has(state)) {
      throw new TaskStateTransitionError(
        `Task in state "${state}" cannot transition to ready.`
      );
    }
  }

  static assertCanMarkExecuting(state: TaskState): void {
    TaskStateMachine.assertExactState(state, "ready", "executing");
  }

  static assertCanComplete(state: TaskState): void {
    TaskStateMachine.assertExactState(state, "executing", "completed");
  }

  static assertCanFail(state: TaskState): void {
    TaskStateMachine.assertExactState(state, "executing", "failed");
  }

  static assertCanReopen(state: TaskState): void {
    if (!reopenableStates.has(state)) {
      throw new TaskStateTransitionError(
        `Task in state "${state}" cannot transition to draft.`
      );
    }
  }

  static assertCanArchive(state: TaskState): void {
    TaskStateMachine.assertExactState(state, "completed", "archived");
  }

  static assertCanAbort(state: TaskState): void {
    TaskStateMachine.assertExactState(state, "executing", "failed");
  }

  private static assertExactState(
    actual: TaskState,
    expected: TaskState,
    target: string
  ): void {
    if (actual !== expected) {
      throw new TaskStateTransitionError(
        `Task in state "${actual}" cannot transition to ${target}.`
      );
    }
  }
}
