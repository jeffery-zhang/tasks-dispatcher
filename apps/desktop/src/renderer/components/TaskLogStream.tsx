interface TaskLogStreamProps {
  log: string;
}

export function TaskLogStream({ log }: TaskLogStreamProps) {
  return (
    <section className="card bg-base-100 shadow-lg">
      <div className="card-body gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Live Log</h2>
          <span className="badge badge-outline">stdout / stderr</span>
        </div>

        <pre className="min-h-64 overflow-auto rounded-box bg-neutral p-4 text-xs text-neutral-content">
          {log || "No output yet."}
        </pre>
      </div>
    </section>
  );
}

