export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task "${taskId}" was not found.`);
    this.name = "TaskNotFoundError";
  }
}

