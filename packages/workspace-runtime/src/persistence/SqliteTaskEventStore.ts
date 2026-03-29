import type { TaskEventStore } from "@tasks-dispatcher/core";
import type { DatabaseSync } from "node:sqlite";
import type { TaskEvent } from "@tasks-dispatcher/core";

export class SqliteTaskEventStore implements TaskEventStore {
  readonly #database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.#database = database;
  }

  async append(event: TaskEvent): Promise<void> {
    const snapshot = event.toSnapshot();

    this.#database
      .prepare(
        `
        INSERT INTO task_events (id, task_id, type, occurred_at)
        VALUES (@id, @taskId, @type, @occurredAt)
      `
      )
      .run({
        id: snapshot.id,
        taskId: snapshot.taskId,
        type: snapshot.type,
        occurredAt: snapshot.occurredAt
      } satisfies Record<string, string>);
  }
}
