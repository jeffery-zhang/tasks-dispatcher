import { describe, expect, it } from "vitest";
import {
  TaskStateMachine,
  TaskStateTransitionError
} from "../../src/domain/TaskStateMachine.js";

describe("TaskStateMachine", () => {
  it("allows editing only in draft", () => {
    expect(TaskStateMachine.canEdit("draft")).toBe(true);
    expect(TaskStateMachine.canEdit("ready")).toBe(false);
    expect(TaskStateMachine.canEdit("failed")).toBe(false);
  });

  it("allows queuing only from draft", () => {
    expect(() => TaskStateMachine.assertCanQueue("draft")).not.toThrow();

    expect(() => TaskStateMachine.assertCanQueue("ready")).toThrow(
      TaskStateTransitionError
    );
    expect(() => TaskStateMachine.assertCanQueue("failed")).toThrow(
      TaskStateTransitionError
    );
  });

  it("allows reopening only from completed and failed", () => {
    expect(() => TaskStateMachine.assertCanReopen("completed")).not.toThrow();
    expect(() => TaskStateMachine.assertCanReopen("failed")).not.toThrow();

    expect(() => TaskStateMachine.assertCanReopen("executing")).toThrow(
      TaskStateTransitionError
    );
  });

  it("only allows archiving from completed", () => {
    expect(() => TaskStateMachine.assertCanArchive("completed")).not.toThrow();
    expect(() => TaskStateMachine.assertCanArchive("draft")).toThrow(
      TaskStateTransitionError
    );
  });
});
