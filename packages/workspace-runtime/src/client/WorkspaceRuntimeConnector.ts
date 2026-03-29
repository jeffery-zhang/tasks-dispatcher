import { RuntimeLauncher } from "../bootstrap/RuntimeLauncher.js";

export async function createWorkspaceRuntimeClient(
  workspaceRoot = process.cwd()
) {
  const launcher = new RuntimeLauncher(workspaceRoot);

  return launcher.connect();
}
