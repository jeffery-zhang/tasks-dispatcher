import type { AgentKind } from "../domain/AgentKind.js";
import type { ExecutionStage } from "../domain/ExecutionStage.js";
import type { TaskAttemptTerminationReason, TaskAttemptStatus } from "../domain/TaskAttempt.js";
import type { TaskState } from "../domain/TaskState.js";
import type { Task } from "../domain/Task.js";

export interface TaskSummaryDto {
  id: string;
  title: string;
  state: TaskState;
  agent: AgentKind;
  updatedAt: string;
  currentAttemptId: string | null;
}

export interface TaskDetailDto {
  id: string;
  title: string;
  description: string;
  agent: AgentKind;
  state: TaskState;
  workflowId: string;
  workflowLabel: string;
  createdAt: string;
  updatedAt: string;
  currentAttemptId: string | null;
  attempts: Array<{
    id: string;
    status: TaskAttemptStatus;
    stage: ExecutionStage;
    terminationReason: TaskAttemptTerminationReason | null;
  }>;
}

export function toTaskSummaryDto(task: Task): TaskSummaryDto {
  const snapshot = task.toSnapshot();

  return {
    id: snapshot.id,
    title: snapshot.title,
    state: snapshot.state,
    agent: snapshot.agent,
    updatedAt: snapshot.updatedAt,
    currentAttemptId: snapshot.currentAttemptId
  };
}

export function toTaskDetailDto(task: Task): TaskDetailDto {
  const snapshot = task.toSnapshot();

  return {
    id: snapshot.id,
    title: snapshot.title,
    description: snapshot.description,
    agent: snapshot.agent,
    state: snapshot.state,
    workflowId: snapshot.workflowId,
    workflowLabel: snapshot.workflowLabel,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    currentAttemptId: snapshot.currentAttemptId,
    attempts: snapshot.attempts.map((attempt) => ({
      id: attempt.id,
      status: attempt.status,
      stage: attempt.stage,
      terminationReason: attempt.terminationReason
    }))
  };
}
