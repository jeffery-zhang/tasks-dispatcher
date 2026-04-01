import type { TaskDetailDto, TaskSummaryDto } from "./TaskDtos.js";

import {
  DEFAULT_WORKFLOW_ID,
  DEFAULT_WORKFLOW_LABEL,
  listTaskWorkflows
} from "../domain/TaskWorkflow.js";

export interface CreateRuntimeTaskInput {
  title: string;
  description: string;
  workflowId: string;
}

export interface UpdateRuntimeTaskInput {
  title: string;
  description: string;
  workflowId: string;
}

export interface TaskWorkflowOptionDto {
  id: string;
  label: string;
}

export const DEFAULT_TASK_WORKFLOW_OPTION = {
  id: DEFAULT_WORKFLOW_ID,
  label: DEFAULT_WORKFLOW_LABEL
} as const satisfies TaskWorkflowOptionDto;

export const TASK_WORKFLOW_OPTIONS = [
  DEFAULT_TASK_WORKFLOW_OPTION,
  ...listTaskWorkflows()
    .filter((workflow) => workflow.id !== DEFAULT_WORKFLOW_ID)
    .map((workflow) => ({
      id: workflow.id,
      label: workflow.label
    }))
] as const satisfies readonly TaskWorkflowOptionDto[];

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
  updateTask(taskId: string, input: UpdateRuntimeTaskInput): Promise<TaskDetailDto>;
  queueTask(taskId: string): Promise<TaskDetailDto>;
  reopenTask(taskId: string): Promise<TaskDetailDto>;
  archiveTask(taskId: string): Promise<TaskDetailDto>;
  abortTask(taskId: string): Promise<TaskDetailDto>;
  readAttemptLog(taskId: string, attemptId: string): Promise<string>;
}
