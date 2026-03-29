import { describe, expect, it } from "vitest";
import {
  TaskStateMachine,
  TaskStateTransitionError
} from "../../src/domain/TaskStateMachine.js";

describe("TaskStateMachine", () => {
  it("allows editing only in initializing and reopened states", () => {
    expect(TaskStateMachine.canEdit("initializing")).toBe(true);
    expect(TaskStateMachine.canEdit("reopened")).toBe(true);
    expect(TaskStateMachine.canEdit("pending_execution")).toBe(false);
    expect(TaskStateMachine.canEdit("execution_failed")).toBe(false);
  });

  it("allows queuing from initializing, reopened, and execution_failed", () => {
    expect(() => TaskStateMachine.assertCanQueue("initializing")).not.toThrow();
    expect(() => TaskStateMachine.assertCanQueue("reopened")).not.toThrow();
    expect(() => TaskStateMachine.assertCanQueue("execution_failed")).not.toThrow();

    expect(() =>
      TaskStateMachine.assertCanQueue("pending_validation")
    ).toThrow(TaskStateTransitionError);
  });

  it("allows reopening only from pending_validation and execution_failed", () => {
    expect(() =>
      TaskStateMachine.assertCanReopen("pending_validation")
    ).not.toThrow();
    expect(() =>
      TaskStateMachine.assertCanReopen("execution_failed")
    ).not.toThrow();

    expect(() => TaskStateMachine.assertCanReopen("executing")).toThrow(
      TaskStateTransitionError
    );
  });

  it("only allows archiving from pending_validation", () => {
    expect(() => TaskStateMachine.assertCanArchive("pending_validation")).not.toThrow();
    expect(() => TaskStateMachine.assertCanArchive("reopened")).toThrow(
      TaskStateTransitionError
    );
  });
});

