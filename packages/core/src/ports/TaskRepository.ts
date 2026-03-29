import type { Task } from "../domain/Task.js";

export interface TaskRepository {
  getById(taskId: string): Promise<Task | null>;
  list(): Promise<Task[]>;
  save(task: Task): Promise<void>;
}

