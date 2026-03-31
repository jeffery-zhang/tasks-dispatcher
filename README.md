# tasks-dispatcher

本地单机的 agent 任务看板。

它把任务空间绑定到当前工作目录，在这个目录下提供：
- 给 agent 用的 `CLI`
- 给人类用的 `Electron` 桌面看板
- 共享的本地 runtime owner
- SQLite 状态库 + per-attempt 日志文件

当前第一版支持：
- `Claude Code`
- `Codex CLI`

## Requirements

- `Node.js >= 24`
- `pnpm >= 10`
- 本机已安装并可直接调用：
  - `claude`
  - `codex`

## Install

```bash
pnpm install
```

## Quick Start

### 1. Typecheck / Test / Build

```bash
pnpm typecheck
pnpm test
pnpm build
```

### 2. Run The Desktop App

```bash
pnpm dev:desktop
```

首次打开时会要求你选择一个工作目录。

选定后：
- 本次会话内不能切换工作目录
- 这个目录下会生成 `.tasks-dispatcher/`
- 任务、事件、日志都只属于这个目录

如果你要做可重复的本地烟测或排障，可以直接指定工作目录：

```bash
TASKS_DISPATCHER_WORKSPACE=D:\Code\test\testdir pnpm dev:desktop
```

Windows PowerShell:

```powershell
$env:TASKS_DISPATCHER_WORKSPACE='D:\Code\test\testdir'
pnpm dev:desktop
```

真实 desktop 启动烟测：

```bash
pnpm test:desktop:smoke
```

这条 smoke test 会跳过目录选择对话框，直接用 `TASKS_DISPATCHER_WORKSPACE` 启动 built desktop app。

### 3. Run The CLI

CLI 默认使用当前 shell 的 `cwd` 作为任务空间。

```bash
pnpm --filter @tasks-dispatcher/cli dev -- create --title "Smoke" --description "Create a smoke task" --workflow default-plan-work-review
pnpm --filter @tasks-dispatcher/cli dev -- show task-1
pnpm --filter @tasks-dispatcher/cli dev -- queue task-1
pnpm --filter @tasks-dispatcher/cli dev -- watch task-1
```

已支持命令：
- `create`
- `queue`
- `reopen`
- `archive`
- `abort`
- `show`
- `watch`

## Workspace Data

每个工作目录下会生成：

```text
.tasks-dispatcher/
  state.sqlite
  logs/
  runtime/
```

说明：
- `state.sqlite` 保存任务、attempt、事件、workspace session
- `logs/` 保存每个 attempt 的原始输出
- `runtime/` 保存本地 runtime owner 的运行时元数据

## Architecture

代码按四层拆：

```text
apps/
  cli/
  desktop/
packages/
  core/
  workspace-runtime/
```

职责：
- `packages/core`
  - 领域模型和应用服务
  - `Task / TaskAttempt / TaskStateMachine`
- `packages/workspace-runtime`
  - 工作目录存储
  - SQLite / 日志文件
  - 调度器 / agent runtime / 本地 HTTP + SSE runtime
- `apps/cli`
  - agent 用的命令式控制面
- `apps/desktop`
  - 人类用的 Electron 看板

关键边界：
- 状态机只在 `core` 收口
- CLI 和 Electron 都不直接碰存储或调度器
- 同一工作目录只允许一个 runtime owner
- `renderer` 只负责 UI，不直接碰 Node

## Current Caveats

- 当前 SQLite 用的是 Node 内置 `node:sqlite`
  - 功能可用
  - 在 Node `24.13.0` 下会打印 `ExperimentalWarning`
- 当前仓库是本地优先设计，不包含多用户、远程 worker、云端同步

## Useful Paths

- [Plan](D:\Code\Projects\tasks-dispatcher\docs\plans\2026-03-29-001-feat-agent-task-board-mvp-plan.md)
- [Requirements](D:\Code\Projects\tasks-dispatcher\docs\brainstorms\2026-03-29-agent-task-board-requirements.md)
- [Core Task Model](D:\Code\Projects\tasks-dispatcher\packages\core\src\domain\Task.ts)
- [Execution Coordinator](D:\Code\Projects\tasks-dispatcher\packages\workspace-runtime\src\dispatching\ExecutionCoordinator.ts)
- [Desktop Task Board](D:\Code\Projects\tasks-dispatcher\apps\desktop\src\renderer\pages\TaskBoardPage.tsx)
