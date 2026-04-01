import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKFLOW_ID,
  SMOKE_FAILURE_WORKFLOW_ID,
  SMOKE_SUCCESS_WORKFLOW_ID,
  getTaskWorkflowDefinition,
  listTaskWorkflows
} from "../../src/domain/TaskWorkflow.js";
import { TASK_WORKFLOW_OPTIONS } from "../../src/contracts/WorkspaceRuntimeApi.js";

describe("TaskWorkflow catalog", () => {
  it("exposes default and smoke-test workflows in the catalog and API options", () => {
    const workflowIds = listTaskWorkflows().map((workflow) => workflow.id);
    const optionIds = TASK_WORKFLOW_OPTIONS.map((workflow) => workflow.id);

    expect(workflowIds).toEqual([
      DEFAULT_WORKFLOW_ID,
      SMOKE_SUCCESS_WORKFLOW_ID,
      SMOKE_FAILURE_WORKFLOW_ID
    ]);
    expect(optionIds).toEqual(workflowIds);
  });

  it("defines the success smoke workflow as plan -> work and the failure smoke workflow as plan -> work", () => {
    const successWorkflow = getTaskWorkflowDefinition(SMOKE_SUCCESS_WORKFLOW_ID);
    const failureWorkflow = getTaskWorkflowDefinition(SMOKE_FAILURE_WORKFLOW_ID);

    expect(successWorkflow.steps.map((step) => step.key)).toEqual(["plan", "work"]);
    expect(failureWorkflow.steps.map((step) => step.key)).toEqual(["plan", "work"]);
    expect(failureWorkflow.steps[1]?.prompt).toContain("failed TASKS_DISPATCHER_RESULT");
  });
});
