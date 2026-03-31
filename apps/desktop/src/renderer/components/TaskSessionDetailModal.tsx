import { useState } from "react";
import type { TaskDetailDto } from "@tasks-dispatcher/core/contracts";
import { OverlayModal } from "./OverlayModal.js";
import { formatTerminationReason } from "../board/failureLabels.js";

interface TaskSessionDetailModalProps {
  attempt: TaskDetailDto["attempts"][number] | null;
  isCurrentAttempt: boolean;
  log: string;
  open: boolean;
  onClose: () => void;
}

export function TaskSessionDetailModal({
  attempt,
  isCurrentAttempt,
  log,
  open,
  onClose
}: TaskSessionDetailModalProps) {
  const [logExpanded, setLogExpanded] = useState(false);

  if (!attempt) {
    return null;
  }

  return (
    <OverlayModal
      onClose={onClose}
      open={open}
      title={`Session ${attempt.id}`}
      widthClassName="max-w-5xl"
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-box border border-base-300 bg-base-200/40 p-4">
            <h3 className="font-semibold">Status</h3>
            <p className="mt-2 text-sm text-base-content/70">{attempt.status}</p>
          </article>
          <article className="rounded-box border border-base-300 bg-base-200/40 p-4">
            <h3 className="font-semibold">Current Step</h3>
            <p className="mt-2 text-sm text-base-content/70">
              {attempt.currentStepKey ?? "n/a"}
            </p>
          </article>
          <article className="rounded-box border border-base-300 bg-base-200/40 p-4">
            <h3 className="font-semibold">Termination</h3>
            <p className="mt-2 text-sm text-base-content/70">
              {formatTerminationReason(attempt.terminationReason)}
            </p>
          </article>
        </div>

        <section className="rounded-box border border-base-300 bg-base-200/40 p-4">
          <h3 className="font-semibold">Steps</h3>
          <div className="mt-3 space-y-2 text-sm text-base-content/70">
            {attempt.steps.map((step) => (
              <div key={step.key} className="flex items-center justify-between gap-4">
                <span>
                  {step.name} ({step.agent})
                </span>
                <span>
                  {step.status}
                  {step.failureReason ? ` / ${step.failureReason}` : ""}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-box border border-base-300 bg-base-100">
          <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
            <div>
              <h3 className="font-semibold">Logs</h3>
              <p className="text-sm text-base-content/60">
                {isCurrentAttempt ? "Live + historical output" : "Historical output"}
              </p>
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setLogExpanded((current) => !current)}
              type="button"
            >
              {logExpanded ? "Hide Logs" : "Show Logs"}
            </button>
          </div>

          {logExpanded && (
            <div className="max-h-[24rem] overflow-auto p-4">
              <pre className="rounded-box bg-neutral p-4 text-xs text-neutral-content">
                {log || "No output yet."}
              </pre>
            </div>
          )}
        </section>
      </div>
    </OverlayModal>
  );
}
