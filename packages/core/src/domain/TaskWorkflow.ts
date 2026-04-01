import type { AgentKind } from "./AgentKind.js";
import type { ExecutionStage } from "./ExecutionStage.js";

export interface WorkflowStepDefinition {
  key: ExecutionStage;
  name: string;
  agent: AgentKind;
  prompt: string;
}

export interface TaskWorkflowDefinition {
  id: string;
  label: string;
  steps: WorkflowStepDefinition[];
}

export interface TaskWorkflowSnapshot {
  id: string;
  label: string;
  steps: WorkflowStepDefinition[];
}

export const DEFAULT_WORKFLOW_ID = "default-plan-work-review";
export const DEFAULT_WORKFLOW_LABEL = "Default Plan / Work / Review";
export const SMOKE_SUCCESS_WORKFLOW_ID = "smoke-plan-work-success";
export const SMOKE_SUCCESS_WORKFLOW_LABEL = "Smoke Plan / Work Success";
export const SMOKE_FAILURE_WORKFLOW_ID = "smoke-plan-work-failure";
export const SMOKE_FAILURE_WORKFLOW_LABEL = "Smoke Plan / Work Failure";

export const DEFAULT_TASK_WORKFLOW: TaskWorkflowDefinition = {
  id: DEFAULT_WORKFLOW_ID,
  label: DEFAULT_WORKFLOW_LABEL,
  steps: [
    {
      key: "plan",
      name: "plan",
      agent: "codex-cli",
      prompt: "Plan the task, inspect the workspace, and decide the execution approach."
    },
    {
      key: "work",
      name: "work",
      agent: "codex-cli",
      prompt: "Implement the task in the workspace and keep changes scoped."
    },
    {
      key: "review",
      name: "review",
      agent: "codex-cli",
      prompt: "Review the completed work, run relevant checks, and summarize residual risk."
    }
  ]
};

export const SMOKE_SUCCESS_TASK_WORKFLOW: TaskWorkflowDefinition = {
  id: SMOKE_SUCCESS_WORKFLOW_ID,
  label: SMOKE_SUCCESS_WORKFLOW_LABEL,
  steps: [
    {
      key: "plan",
      name: "plan",
      agent: "codex-cli",
      prompt:
        "This is a smoke-test workflow. Do not inspect or modify the workspace. Immediately print a completed TASKS_DISPATCHER_RESULT line for this step and exit."
    },
    {
      key: "work",
      name: "work",
      agent: "codex-cli",
      prompt:
        "This is a smoke-test workflow. Do not inspect or modify the workspace. Immediately print a completed TASKS_DISPATCHER_RESULT line for this step and exit."
    }
  ]
};

export const SMOKE_FAILURE_TASK_WORKFLOW: TaskWorkflowDefinition = {
  id: SMOKE_FAILURE_WORKFLOW_ID,
  label: SMOKE_FAILURE_WORKFLOW_LABEL,
  steps: [
    {
      key: "plan",
      name: "plan",
      agent: "codex-cli",
      prompt:
        "This is a smoke-test workflow. Do not inspect or modify the workspace. Immediately print a completed TASKS_DISPATCHER_RESULT line for this step and exit."
    },
    {
      key: "work",
      name: "work",
      agent: "codex-cli",
      prompt:
        "This is a smoke-test workflow. Do not inspect or modify the workspace. Immediately print a failed TASKS_DISPATCHER_RESULT line with failureReason `needs_input` for this step and exit."
    }
  ]
};

const WORKFLOW_CATALOG = new Map<string, TaskWorkflowDefinition>([
  [DEFAULT_TASK_WORKFLOW.id, DEFAULT_TASK_WORKFLOW],
  [SMOKE_SUCCESS_TASK_WORKFLOW.id, SMOKE_SUCCESS_TASK_WORKFLOW],
  [SMOKE_FAILURE_TASK_WORKFLOW.id, SMOKE_FAILURE_TASK_WORKFLOW]
]);

function cloneWorkflow(
  workflow: TaskWorkflowDefinition
): TaskWorkflowDefinition {
  return {
    id: workflow.id,
    label: workflow.label,
    steps: workflow.steps.map((step) => ({ ...step }))
  };
}

export function listTaskWorkflows(): TaskWorkflowDefinition[] {
  return [...WORKFLOW_CATALOG.values()].map(cloneWorkflow);
}

export function getTaskWorkflowDefinition(
  workflowId: string
): TaskWorkflowDefinition {
  const workflow = WORKFLOW_CATALOG.get(workflowId);

  if (!workflow) {
    throw new Error(`Unknown workflow "${workflowId}".`);
  }

  return cloneWorkflow(workflow);
}

export function cloneTaskWorkflowSnapshot(
  workflowId: string
): TaskWorkflowSnapshot {
  const workflow = getTaskWorkflowDefinition(workflowId);

  return {
    id: workflow.id,
    label: workflow.label,
    steps: workflow.steps.map((step) => ({ ...step }))
  };
}
