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

export const DEFAULT_TASK_WORKFLOW: TaskWorkflowDefinition = {
  id: DEFAULT_WORKFLOW_ID,
  label: DEFAULT_WORKFLOW_LABEL,
  steps: [
    {
      key: "plan",
      name: "plan",
      agent: "claude-code",
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
      agent: "claude-code",
      prompt: "Review the completed work, run relevant checks, and summarize residual risk."
    }
  ]
};

const WORKFLOW_CATALOG = new Map<string, TaskWorkflowDefinition>([
  [DEFAULT_TASK_WORKFLOW.id, DEFAULT_TASK_WORKFLOW]
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
