export const TASK_EVENT_TYPES = [
  "task_created",
  "task_queued",
  "execution_started",
  "execution_step_changed",
  "execution_failed",
  "task_completed",
  "task_reopened",
  "task_archived",
  "task_aborted"
] as const;

export type TaskEventType = (typeof TASK_EVENT_TYPES)[number];

export interface TaskEventSnapshot {
  id: string;
  taskId: string;
  type: TaskEventType;
  occurredAt: string;
}

export class TaskEvent {
  readonly #id: string;
  readonly #taskId: string;
  readonly #type: TaskEventType;
  readonly #occurredAt: Date;

  constructor(props: {
    id: string;
    taskId: string;
    type: TaskEventType;
    occurredAt: Date;
  }) {
    this.#id = props.id;
    this.#taskId = props.taskId;
    this.#type = props.type;
    this.#occurredAt = props.occurredAt;
  }

  toSnapshot(): TaskEventSnapshot {
    return {
      id: this.#id,
      taskId: this.#taskId,
      type: this.#type,
      occurredAt: this.#occurredAt.toISOString()
    };
  }
}
