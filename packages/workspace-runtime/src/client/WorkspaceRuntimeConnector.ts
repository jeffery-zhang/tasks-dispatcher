import { RuntimeLauncher } from "../bootstrap/RuntimeLauncher.js";
import type { RuntimeLaunchTarget } from "../bootstrap/RuntimeLaunchTarget.js";

interface WorkspaceRuntimeClientOptions {
  launchTarget?: RuntimeLaunchTarget;
}

export async function createWorkspaceRuntimeClient(
  workspaceRoot = process.cwd(),
  options?: WorkspaceRuntimeClientOptions
) {
  const launcher = new RuntimeLauncher(workspaceRoot, options);

  return launcher.connect();
}
