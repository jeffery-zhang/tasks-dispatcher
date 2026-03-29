import type { TaskEvent } from "../domain/TaskEvent.js";

export interface TaskEventStore {
  append(event: TaskEvent): Promise<void>;
}

