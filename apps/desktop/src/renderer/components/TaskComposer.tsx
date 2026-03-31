import { startTransition, useState } from "react";
import {
  DEFAULT_TASK_WORKFLOW_OPTION,
  TASK_WORKFLOW_OPTIONS
} from "@tasks-dispatcher/core/contracts";

interface TaskComposerProps {
  onCreate: (input: {
    title: string;
    description: string;
    workflowId: string;
  }) => Promise<void>;
}

export function TaskComposer({ onCreate }: TaskComposerProps) {
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
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card bg-base-100 shadow-lg" onSubmit={handleSubmit}>
      <div className="card-body gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Create Task</h2>
            <p className="text-sm text-base-content/60">
              New tasks stay in draft until you explicitly queue them.
            </p>
          </div>
          <div className="badge badge-outline badge-secondary">
            {DEFAULT_TASK_WORKFLOW_OPTION.label}
          </div>
        </div>

        <label className="form-control gap-2">
          <span className="label-text font-medium">Title</span>
          <input
            className="input input-bordered"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Implement feature or fix bug"
            required
          />
        </label>

        <label className="form-control gap-2">
          <span className="label-text font-medium">Description</span>
          <textarea
            className="textarea textarea-bordered min-h-28"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe the task for the selected workflow."
            required
          />
        </label>

        <label className="form-control gap-2">
          <span className="label-text font-medium">Workflow</span>
          <select
            className="select select-bordered"
            value={workflowId}
            onChange={(event) => setWorkflowId(event.target.value)}
          >
            {TASK_WORKFLOW_OPTIONS.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.label}
              </option>
            ))}
          </select>
        </label>

        <div className="card-actions justify-end">
          <button className="btn btn-primary" disabled={submitting} type="submit">
            {submitting ? "Creating..." : "Create Draft"}
          </button>
        </div>
      </div>
    </form>
  );
}
