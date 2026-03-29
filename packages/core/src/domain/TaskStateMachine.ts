import type { TaskState } from "./TaskState.js";

const editableStates = new Set<TaskState>(["initializing", "reopened"]);
const queueableStates = new Set<TaskState>([
  "initializing",
  "reopened",
  "execution_failed"
]);
const reopenableStates = new Set<TaskState>([
  "pending_validation",
  "execution_failed"
]);

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
        `Task in state "${state}" cannot transition to pending execution.`
      );
    }
  }

  static assertCanMarkExecuting(state: TaskState): void {
    TaskStateMachine.assertExactState(state, "pending_execution", "executing");
  }

  static assertCanAwaitValidation(state: TaskState): void {
    TaskStateMachine.assertExactState(
      state,
      "executing",
      "pending validation"
    );
  }

  static assertCanFail(state: TaskState): void {
    TaskStateMachine.assertExactState(state, "executing", "execution failed");
  }

  static assertCanReopen(state: TaskState): void {
    if (!reopenableStates.has(state)) {
      throw new TaskStateTransitionError(
        `Task in state "${state}" cannot transition to reopened.`
      );
    }
  }

  static assertCanArchive(state: TaskState): void {
    TaskStateMachine.assertExactState(state, "pending_validation", "archived");
  }

  static assertCanAbort(state: TaskState): void {
    TaskStateMachine.assertExactState(state, "executing", "execution failed");
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
