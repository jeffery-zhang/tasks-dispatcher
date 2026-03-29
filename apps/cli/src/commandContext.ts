import type { WorkspaceRuntimeClient } from "@tasks-dispatcher/workspace-runtime/client";

export interface CommandContext {
  client: WorkspaceRuntimeClient;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

