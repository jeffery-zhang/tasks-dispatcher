import { startTransition, useState } from "react";
import type { AgentKind } from "@tasks-dispatcher/core";

interface TaskComposerProps {
  onCreate: (input: {
    title: string;
    description: string;
    agent: AgentKind;
  }) => Promise<void>;
}

export function TaskComposer({ onCreate }: TaskComposerProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agent, setAgent] = useState<AgentKind>("codex-cli");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await onCreate({ title, description, agent });
      startTransition(() => {
        setTitle("");
        setDescription("");
        setAgent("codex-cli");
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
              New tasks stay in draft (`初始化`) until you explicitly queue them.
            </p>
          </div>
          <div className="badge badge-outline badge-secondary">
            Default Plan / Develop / Self-check
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
            placeholder="Describe the task for the selected agent."
            required
          />
        </label>

        <label className="form-control gap-2">
          <span className="label-text font-medium">Agent</span>
          <select
            className="select select-bordered"
            value={agent}
            onChange={(event) => setAgent(event.target.value as AgentKind)}
          >
            <option value="codex-cli">Codex CLI</option>
            <option value="claude-code">Claude Code</option>
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

