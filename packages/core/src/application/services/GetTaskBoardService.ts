import { toTaskSummaryDto } from "../../contracts/TaskDtos.js";
import type { TaskRepository } from "../../ports/TaskRepository.js";

export class GetTaskBoardService {
  readonly #taskRepository: TaskRepository;

  constructor(taskRepository: TaskRepository) {
    this.#taskRepository = taskRepository;
  }

  async execute() {
    const tasks = await this.#taskRepository.list();

    return tasks
      .map((task) => toTaskSummaryDto(task))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
}
