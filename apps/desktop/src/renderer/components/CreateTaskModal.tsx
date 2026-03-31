import { startTransition, useState } from "react";
import {
  DEFAULT_TASK_WORKFLOW_OPTION,
  TASK_WORKFLOW_OPTIONS,
  type CreateRuntimeTaskInput
} from "@tasks-dispatcher/core/contracts";
import { OverlayModal } from "./OverlayModal.js";

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateRuntimeTaskInput) => Promise<void>;
}

export function CreateTaskModal({
  open,
  onClose,
  onCreate
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workflowId, setWorkflowId] = useState<string>(
    DEFAULT_TASK_WORKFLOW_OPTION.id
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await onCreate({ title, description, workflowId });
      startTransition(() => {
        setTitle("");
        setDescription("");
        setWorkflowId(DEFAULT_TASK_WORKFLOW_OPTION.id);
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <OverlayModal onClose={onClose} open={open} title="Add Task">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="rounded-box border border-base-300 bg-base-200/40 p-4 text-sm text-base-content/65">
          Current workflow catalog is fixed, but selection is still explicit.
        </div>

        <label className="form-control gap-2">
          <span className="label-text font-medium">Title</span>
          <input
            className="input input-bordered"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Implement feature or fix bug"
            required
            value={title}
          />
        </label>

        <label className="form-control gap-2">
          <span className="label-text font-medium">Description</span>
          <textarea
            className="textarea textarea-bordered min-h-32"
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe the task for the selected workflow."
            required
            value={description}
          />
        </label>

        <label className="form-control gap-2">
          <span className="label-text font-medium">Workflow</span>
          <select
            className="select select-bordered"
            onChange={(event) => setWorkflowId(event.target.value)}
            value={workflowId}
          >
            {TASK_WORKFLOW_OPTIONS.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn btn-primary" disabled={submitting} type="submit">
            {submitting ? "Creating..." : "Create Draft"}
          </button>
        </div>
      </form>
    </OverlayModal>
  );
}
