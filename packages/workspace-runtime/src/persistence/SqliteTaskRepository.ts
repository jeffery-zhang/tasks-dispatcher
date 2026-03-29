import { Task } from "@tasks-dispatcher/core";
import type { TaskRepository } from "@tasks-dispatcher/core";
import type { TaskSnapshot } from "@tasks-dispatcher/core";
import type { TaskAttemptSnapshot } from "@tasks-dispatcher/core";
import type { DatabaseSync } from "node:sqlite";

function mapTaskRow(row: Record<string, unknown>): Omit<TaskSnapshot, "attempts"> {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description),
    agent: row.agent as TaskSnapshot["agent"],
    workflowId: String(row.workflow_id),
    workflowLabel: String(row.workflow_label),
    state: row.state as TaskSnapshot["state"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    currentAttemptId: row.current_attempt_id ? String(row.current_attempt_id) : null
  };
}

function mapAttemptRow(row: Record<string, unknown>): TaskAttemptSnapshot {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    agent: row.agent as TaskAttemptSnapshot["agent"],
    status: row.status as TaskAttemptSnapshot["status"],
    stage: row.stage as TaskAttemptSnapshot["stage"],
    createdAt: String(row.created_at),
    startedAt: row.started_at ? String(row.started_at) : null,
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    terminationReason: row.termination_reason
      ? (String(row.termination_reason) as TaskAttemptSnapshot["terminationReason"])
      : null
  };
}

export class SqliteTaskRepository implements TaskRepository {
  readonly #database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.#database = database;
  }

  async getById(taskId: string): Promise<Task | null> {
    const taskRow = this.#database
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(taskId) as Record<string, unknown> | undefined;

    if (!taskRow) {
      return null;
    }

    const attemptRows = this.#database
      .prepare("SELECT * FROM task_attempts WHERE task_id = ? ORDER BY created_at ASC")
      .all(taskId) as Array<Record<string, unknown>>;

    return Task.rehydrate({
      ...mapTaskRow(taskRow),
      attempts: attemptRows.map(mapAttemptRow)
    });
  }

  async list(): Promise<Task[]> {
    const taskRows = this.#database.prepare("SELECT * FROM tasks").all() as Array<
      Record<string, unknown>
    >;

    return taskRows.map((taskRow) => {
      const taskId = String(taskRow.id);
      const attemptRows = this.#database
        .prepare("SELECT * FROM task_attempts WHERE task_id = ? ORDER BY created_at ASC")
        .all(taskId) as Array<Record<string, unknown>>;

      return Task.rehydrate({
        ...mapTaskRow(taskRow),
        attempts: attemptRows.map(mapAttemptRow)
      });
    });
  }

  async save(task: Task): Promise<void> {
    const snapshot = task.toSnapshot();
    const taskValues = {
      id: snapshot.id,
      title: snapshot.title,
      description: snapshot.description,
      agent: snapshot.agent,
      workflowId: snapshot.workflowId,
      workflowLabel: snapshot.workflowLabel,
      state: snapshot.state,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      currentAttemptId: snapshot.currentAttemptId
    } satisfies Record<string, string | null>;
    const upsertTask = this.#database.prepare(`
      INSERT INTO tasks (
        id, title, description, agent, workflow_id, workflow_label, state, created_at, updated_at, current_attempt_id
      ) VALUES (
        @id, @title, @description, @agent, @workflowId, @workflowLabel, @state, @createdAt, @updatedAt, @currentAttemptId
      )
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        agent = excluded.agent,
        workflow_id = excluded.workflow_id,
        workflow_label = excluded.workflow_label,
        state = excluded.state,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        current_attempt_id = excluded.current_attempt_id
    `);
    const deleteAttempts = this.#database.prepare(
      "DELETE FROM task_attempts WHERE task_id = ?"
    );
    const insertAttempt = this.#database.prepare(`
      INSERT INTO task_attempts (
        id, task_id, agent, status, stage, created_at, started_at, finished_at, termination_reason
      ) VALUES (
        @id, @taskId, @agent, @status, @stage, @createdAt, @startedAt, @finishedAt, @terminationReason
      )
    `);

    this.#database.exec("BEGIN");

    try {
      upsertTask.run(taskValues);
      deleteAttempts.run(snapshot.id);

      for (const attempt of snapshot.attempts) {
        insertAttempt.run({
          id: attempt.id,
          taskId: attempt.taskId,
          agent: attempt.agent,
          status: attempt.status,
          stage: attempt.stage,
          createdAt: attempt.createdAt,
          startedAt: attempt.startedAt,
          finishedAt: attempt.finishedAt,
          terminationReason: attempt.terminationReason
        } satisfies Record<string, string | null>);
      }

      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }
}
