---
title: Windows Codex process launch gotchas
date: 2026-03-29
category: integration-issues
module: workspace-runtime
problem_type: integration_issue
component: tooling
symptoms:
  - Codex CLI exits immediately with argument parsing errors on Windows
  - Large prompt strings get split incorrectly when launched through the shell
  - Direct process start can fail with spawn EINVAL
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags: [windows, codex-cli, child-process, spawn, process-launch]
---

# Windows Codex process launch gotchas

## Problem
Launching `codex` from Node on Windows is not the same as launching it on Unix. The wrong `child_process` strategy causes prompt corruption or outright process launch failure.

## Symptoms
- `codex exec` returns errors like `unexpected argument 'are' found`
- The CLI receives a broken prompt even though the original string was valid
- Switching away from `shell: true` can then fail with `spawn EINVAL`

## What Didn't Work
- `shell: true` looked convenient, but Windows shell processing split the prompt into the wrong argv pieces.
- Directly spawning `codex.cmd` without going through `cmd.exe` still failed on Windows in this environment.

## Solution
Use two different launch paths:

- Unix-like platforms: spawn the command directly with `shell: false`
- Windows + `codex`: explicitly launch through `cmd.exe`

The working implementation is:

```ts
export class NodeChildProcessRunner {
  start(spec: AgentLaunchSpec, workspaceRoot: string) {
    if (process.platform === "win32" && spec.command === "codex") {
      return spawn("cmd.exe", ["/d", "/s", "/c", "codex.cmd", ...spec.args], {
        cwd: workspaceRoot,
        shell: false,
        stdio: "pipe"
      });
    }

    return spawn(spec.command, spec.args, {
      cwd: workspaceRoot,
      shell: false,
      stdio: "pipe"
    });
  }
}
```

This preserves the prompt as real argv data and avoids the Windows-specific launch failure.

## Why This Works
There are two separate problems:
- `shell: true` lets the shell reinterpret your prompt string
- Windows command wrappers like `codex.cmd` are not always safely launchable the same way as a native executable

Routing `codex` through `cmd.exe /d /s /c` keeps Windows happy without reintroducing shell-based prompt splitting. The rest of the platforms can stay on plain argv-based spawning.

## Prevention
- Do not use `shell: true` for agent process launches that carry large prompt strings.
- Treat Windows command wrappers (`*.cmd`) as a separate integration path, not a transparent equivalent to native executables.
- Keep at least one smoke test that exercises a real `codex-cli` task on Windows.
- If a future refactor touches process launching, re-check these symptoms first:
  - prompt split errors
  - `spawn EINVAL`
  - immediate exit before any stage markers appear

## Related Issues
- None yet. This is the first documented Windows-specific agent launch fix in the repo.

