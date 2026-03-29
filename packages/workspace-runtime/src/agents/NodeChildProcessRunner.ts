import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { AgentLaunchSpec } from "./AgentRuntime.js";

export class NodeChildProcessRunner {
  start(spec: AgentLaunchSpec, workspaceRoot: string): ChildProcessWithoutNullStreams {
    const childProcess =
      process.platform === "win32" && spec.command === "codex"
        ? spawn("cmd.exe", ["/d", "/s", "/c", "codex.cmd", ...spec.args], {
            cwd: workspaceRoot,
            shell: false,
            stdio: "pipe"
          })
        : spawn(spec.command, spec.args, {
            cwd: workspaceRoot,
            shell: false,
            stdio: "pipe"
          });

    if (spec.stdinText) {
      childProcess.stdin.write(spec.stdinText);
      childProcess.stdin.end();
    }

    return childProcess;
  }
}
