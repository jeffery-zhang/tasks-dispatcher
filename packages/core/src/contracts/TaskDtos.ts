import type { AgentKind } from "../domain/AgentKind.js";
import type { ExecutionStage } from "../domain/ExecutionStage.js";
import type {
  TaskAttemptTerminationReason,
  TaskAttemptStatus
} from "../domain/TaskAttempt.js";
import type { TaskState } from "../domain/TaskState.js";
import type { Task } from "../domain/Task.js";
import type { WorkflowStepStatus } from "../domain/WorkflowStepStatus.js";

export interface TaskStepDto {
  key: ExecutionStage;
  name: string;
  agent: AgentKind;
  prompt: string;
  status: WorkflowStepStatus;
  finishedAt: string | null;
  failureReason: TaskAttemptTerminationReason | null;
}

export interface TaskSummaryDto {
  id: string;
  title: string;
  description: string;
  state: TaskState;
  workflowId: string;
  workflowLabel: string;
  updatedAt: string;
  currentAttemptId: string | null;
  currentAttemptTerminationReason: TaskAttemptTerminationReason | null;
  currentStepKey: ExecutionStage | null;
  currentStepStatus: WorkflowStepStatus | null;
  currentStepAgent: AgentKind | null;
}

export interface TaskDetailDto {
  id: string;
  title: string;
  description: string;
  state: TaskState;
  workflowId: string;
  workflowLabel: string;
  createdAt: string;
  updatedAt: string;
  currentAttemptId: string | null;
  currentStepKey: ExecutionStage | null;
  currentStepStatus: WorkflowStepStatus | null;
  currentStepAgent: AgentKind | null;
  attempts: Array<{
    id: string;
    status: TaskAttemptStatus;
    workflowId: string;
    workflowLabel: string;
    currentStepKey: ExecutionStage | null;
    startedAt: string | null;
    finishedAt: string | null;
    terminationReason: TaskAttemptTerminationReason | null;
    steps: TaskStepDto[];
  }>;
}

export function toTaskSummaryDto(task: Task): TaskSummaryDto {
  const snapshot = task.toSnapshot();
  const currentAttempt =
    snapshot.attempts.find((attempt) => attempt.id === snapshot.currentAttemptId) ?? null;
  const currentStep =
    currentAttempt?.steps.find((step) => step.key === currentAttempt.currentStepKey) ?? null;

  return {
    id: snapshot.id,
    title: snapshot.title,
    description: snapshot.description,
    state: snapshot.state,
    workflowId: snapshot.workflowId,
    workflowLabel: snapshot.workflowLabel,
    updatedAt: snapshot.updatedAt,
    currentAttemptId: snapshot.currentAttemptId,
    currentAttemptTerminationReason: currentAttempt?.terminationReason ?? null,
    currentStepKey: currentAttempt?.currentStepKey ?? null,
    currentStepStatus: currentStep?.status ?? null,
    currentStepAgent: currentStep?.agent ?? null
  };
}

export function toTaskDetailDto(task: Task): TaskDetailDto {
  const snapshot = task.toSnapshot();
  const currentAttempt =
    snapshot.attempts.find((attempt) => attempt.id === snapshot.currentAttemptId) ?? null;
  const currentStep =
    currentAttempt?.steps.find((step) => step.key === currentAttempt.currentStepKey) ?? null;

  return {
    id: snapshot.id,
    title: snapshot.title,
    description: snapshot.description,
    state: snapshot.state,
    workflowId: snapshot.workflowId,
    workflowLabel: snapshot.workflowLabel,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    currentAttemptId: snapshot.currentAttemptId,
    currentStepKey: currentAttempt?.currentStepKey ?? null,
    currentStepStatus: currentStep?.status ?? null,
    currentStepAgent: currentStep?.agent ?? null,
    attempts: snapshot.attempts.map((attempt) => ({
      id: attempt.id,
      status: attempt.status,
      workflowId: attempt.workflowId,
      workflowLabel: attempt.workflowLabel,
      currentStepKey: attempt.currentStepKey,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      terminationReason: attempt.terminationReason,
      steps: attempt.steps.map((step) => ({
        key: step.key,
        name: step.name,
        agent: step.agent,
        prompt: step.prompt,
        status: step.status,
        finishedAt: step.finishedAt,
        failureReason: step.failureReason
      }))
    }))
  };
}
