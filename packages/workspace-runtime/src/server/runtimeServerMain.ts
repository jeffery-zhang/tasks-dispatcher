import { RuntimeLauncher } from "../bootstrap/RuntimeLauncher.js";
import { WorkspaceServer } from "./WorkspaceServer.js";
import { WorkspaceRuntimeService } from "./WorkspaceRuntimeService.js";

function parseWorkspaceRoot(argv: string[]): string {
  const flagIndex = argv.indexOf("--workspace-root");
  const workspaceRoot = flagIndex === -1 ? undefined : argv[flagIndex + 1];

  if (!workspaceRoot) {
    throw new Error("Missing required --workspace-root argument.");
  }

  return workspaceRoot;
}

async function main(): Promise<void> {
  const workspaceRoot = parseWorkspaceRoot(process.argv.slice(2));
  const launcher = new RuntimeLauncher(workspaceRoot);
  const runtimeService = await WorkspaceRuntimeService.open(workspaceRoot);
  const workspaceServer = new WorkspaceServer(runtimeService);
  const port = await workspaceServer.listen();

  launcher.writeMetadata({
    pid: process.pid,
    port,
    workspaceRoot
  });

  const idleTimer = setInterval(() => {
    if (
      workspaceServer.activeExecutionCount === 0 &&
      workspaceServer.activeClientCount === 0 &&
      workspaceServer.idleForMs >= 5_000
    ) {
      void shutdown();
    }
  }, 1_000);

  const shutdown = async () => {
    clearInterval(idleTimer);
    launcher.clearMetadata();
    await workspaceServer.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    void shutdown();
  });
  process.on("SIGINT", () => {
    void shutdown();
  });
}

void main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Unknown runtime error."}\n`
  );
  process.exit(1);
});
