import type { AgentKind } from "../domain/AgentKind.js";
import type { TaskDetailDto, TaskSummaryDto } from "./TaskDtos.js";

export interface CreateRuntimeTaskInput {
  title: string;
  description: string;
  agent: AgentKind;
}

export interface WorkspaceRuntimeEvent {
  type: "task.updated" | "task.log";
  taskId: string;
  task?: TaskDetailDto;
  attemptId?: string;
  chunk?: string;
}

export interface WorkspaceRuntimeApi {
  ping(): Promise<string>;
  listTasks(): Promise<TaskSummaryDto[]>;
  getTask(taskId: string): Promise<TaskDetailDto | null>;
  createTask(input: CreateRuntimeTaskInput): Promise<TaskDetailDto>;
  queueTask(taskId: string): Promise<TaskDetailDto>;
  reopenTask(taskId: string): Promise<TaskDetailDto>;
  archiveTask(taskId: string): Promise<TaskDetailDto>;
  abortTask(taskId: string): Promise<TaskDetailDto>;
  readAttemptLog(taskId: string, attemptId: string): Promise<string>;
}
