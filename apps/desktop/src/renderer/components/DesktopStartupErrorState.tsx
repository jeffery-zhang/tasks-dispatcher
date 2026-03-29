import type { DesktopStartupError } from "../startup/desktopStartup.js";

interface DesktopStartupErrorStateProps {
  error: DesktopStartupError;
}

const ERROR_TITLES: Record<DesktopStartupError["code"], string> = {
  preload_missing: "Desktop preload failed to load",
  bridge_missing: "Desktop bridge is unavailable",
  runtime_bootstrap_failed: "Workspace runtime failed to start",
  initial_query_failed: "Desktop startup query failed"
};

export function DesktopStartupErrorState({
  error
}: DesktopStartupErrorStateProps) {
  return (
    <main className="min-h-screen bg-base-200 p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="rounded-box border border-warning/40 bg-base-100 p-6 shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-warning">
            Tasks Dispatcher
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">
            {ERROR_TITLES[error.code]}
          </h1>
          <p className="mt-3 text-sm text-base-content/70">
            The desktop app did not finish bootstrapping. This state is shown
            intentionally so the failure is visible instead of leaving a blank page.
          </p>
        </header>

        <section className="rounded-box border border-base-300 bg-base-100 p-6 shadow-lg">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="font-semibold text-base-content/70">Failure Type</dt>
              <dd className="mt-1 font-mono">{error.code}</dd>
            </div>
            <div>
              <dt className="font-semibold text-base-content/70">Message</dt>
              <dd className="mt-1 whitespace-pre-wrap font-mono">{error.message}</dd>
            </div>
            {error.expectedPath && (
              <div>
                <dt className="font-semibold text-base-content/70">Expected Path</dt>
                <dd className="mt-1 break-all font-mono">{error.expectedPath}</dd>
              </div>
            )}
            {error.workspaceRoot && (
              <div>
                <dt className="font-semibold text-base-content/70">Workspace</dt>
                <dd className="mt-1 break-all font-mono">{error.workspaceRoot}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>
    </main>
  );
}
