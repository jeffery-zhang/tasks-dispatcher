import { describe, expect, it } from "vitest";
import { Task } from "@tasks-dispatcher/core";
import type { TaskRepository } from "@tasks-dispatcher/core";
import { ConcurrencyGate } from "../../src/dispatching/ConcurrencyGate.js";
import { TaskScheduler } from "../../src/dispatching/TaskScheduler.js";

class InMemoryTaskRepository implements TaskRepository {
  readonly #tasks: Task[];

  constructor(tasks: Task[]) {
    this.#tasks = tasks;
  }

  async getById(taskId: string): Promise<Task | null> {
    return this.#tasks.find((task) => task.id === taskId) ?? null;
  }

  async list(): Promise<Task[]> {
    return this.#tasks;
  }

  async save(): Promise<void> {}
}

describe("TaskScheduler", () => {
  it("starts ready tasks in FIFO order while respecting capacity", async () => {
    const firstTask = Task.createDraft({
      id: "task-1",
      title: "First",
      description: "Older",
      workflowId: "default-plan-work-review",
      createdAt: new Date("2026-03-29T00:00:00.000Z")
    });
    const secondTask = Task.createDraft({
      id: "task-2",
      title: "Second",
      description: "Middle",
      workflowId: "default-plan-work-review",
      createdAt: new Date("2026-03-29T00:00:10.000Z")
    });
    const thirdTask = Task.createDraft({
      id: "task-3",
      title: "Third",
      description: "Newest",
      workflowId: "default-plan-work-review",
      createdAt: new Date("2026-03-29T00:00:20.000Z")
    });

    firstTask.queueForExecution({
      attemptId: "attempt-1",
      queuedAt: new Date("2026-03-29T00:01:00.000Z")
    });
    secondTask.queueForExecution({
      attemptId: "attempt-2",
      queuedAt: new Date("2026-03-29T00:02:00.000Z")
    });
    thirdTask.queueForExecution({
      attemptId: "attempt-3",
      queuedAt: new Date("2026-03-29T00:03:00.000Z")
    });

    const startedTaskIds: string[] = [];
    const concurrencyGate = new ConcurrencyGate(2);
    const tasks = [firstTask, secondTask, thirdTask];
    const scheduler = new TaskScheduler({
      taskRepository: new InMemoryTaskRepository(tasks),
      concurrencyGate,
      executionCoordinator: {
        async startTask(taskId: string) {
          startedTaskIds.push(taskId);
          concurrencyGate.acquire();
          const task = tasks.find((candidate) => candidate.id === taskId);

          task?.markExecuting(new Date("2026-03-29T00:05:00.000Z"));
        }
      } as never
    });

    await scheduler.kick();

    expect(startedTaskIds).toEqual(["task-1", "task-2"]);
  });
});
