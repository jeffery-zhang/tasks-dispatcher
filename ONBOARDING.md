# ONBOARDING

## What This Repo Is

这是一个本地单机的 agent task board。

目标不是做云平台，而是把一个工作目录里的任务流收口成：
- 人类创建 / 验收 / 归档
- agent 认领并执行
- CLI 和 Electron 共享同一套本地 runtime

## Read This First

1. [Requirements](D:\Code\Projects\tasks-dispatcher\docs\brainstorms\2026-03-29-agent-task-board-requirements.md)
2. [Plan](D:\Code\Projects\tasks-dispatcher\docs\plans\2026-03-29-001-feat-agent-task-board-mvp-plan.md)
3. [README](D:\Code\Projects\tasks-dispatcher\README.md)

## Package Map

### `packages/core`

核心业务规则。

从这里开始读：
- [Task.ts](D:\Code\Projects\tasks-dispatcher\packages\core\src\domain\Task.ts)
- [TaskAttempt.ts](D:\Code\Projects\tasks-dispatcher\packages\core\src\domain\TaskAttempt.ts)
- [TaskStateMachine.ts](D:\Code\Projects\tasks-dispatcher\packages\core\src\domain\TaskStateMachine.ts)

这里负责：
- 任务状态机
- 可编辑性规则
- attempt 生命周期
- 创建 / 排队 / 重开 / 归档 / 中止这些用例服务

这里不应该碰：
- Electron
- CLI 参数解析
- SQLite
- child process

### `packages/workspace-runtime`

本地工作目录运行时。

从这里开始读：
- [WorkspaceRuntimeService.ts](D:\Code\Projects\tasks-dispatcher\packages\workspace-runtime\src\server\WorkspaceRuntimeService.ts)
- [ExecutionCoordinator.ts](D:\Code\Projects\tasks-dispatcher\packages\workspace-runtime\src\dispatching\ExecutionCoordinator.ts)
- [WorkspaceStorage.ts](D:\Code\Projects\tasks-dispatcher\packages\workspace-runtime\src\persistence\WorkspaceStorage.ts)
- [RuntimeLauncher.ts](D:\Code\Projects\tasks-dispatcher\packages\workspace-runtime\src\bootstrap\RuntimeLauncher.ts)

这里负责：
- `.tasks-dispatcher/` 目录
- SQLite 状态库
- 日志文件
- FIFO 调度
- agent 进程启动 / 中止 / stage 解析
- HTTP + SSE 本地 runtime API

### `apps/cli`

给 agent 用的控制面。

入口：
- [apps/cli/src/index.ts](D:\Code\Projects\tasks-dispatcher\apps\cli\src\index.ts)

原则：
- 默认用当前 `cwd` 作为任务空间
- 只通过 runtime client 调用共享运行时
- 不直接碰状态机 / 存储 / 调度

### `apps/desktop`

给人类用的桌面看板。

入口：
- [main.ts](D:\Code\Projects\tasks-dispatcher\apps\desktop\src\main\main.ts)
- [taskBoardApi.ts](D:\Code\Projects\tasks-dispatcher\apps\desktop\src\preload\taskBoardApi.ts)
- [TaskBoardPage.tsx](D:\Code\Projects\tasks-dispatcher\apps\desktop\src\renderer\pages\TaskBoardPage.tsx)

原则：
- `main / preload / renderer` 分层
- renderer 用 `React + TailwindCSS + daisyUI`
- renderer 不直接碰 Node 或本地存储

## Development Commands

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm dev:desktop
pnpm --filter @tasks-dispatcher/cli dev -- create --title "Example" --description "Example task" --agent codex-cli
```

## Testing Notes

当前测试覆盖主要集中在：
- `packages/core/tests/**`
- `packages/workspace-runtime/tests/**`
- `apps/cli/tests/**`
- `apps/desktop/src/main/__tests__/**`

如果你改了：
- 状态机：先看 `TaskStateMachine.test.ts`
- 调度 / runtime：先看 `packages/workspace-runtime/tests/**`
- CLI 命令：先看 `apps/cli/tests/**`

## Important Constraints

- 只用 `pnpm`，不要用 `npm`
- 一个工作目录只允许一个 runtime owner
- `Task` 和 `TaskAttempt` 不能混
- 状态转换必须继续收口在 `core`
- renderer 不要穿透到 runtime internals

## Current Rough Edges

- `node:sqlite` 仍会打印 experimental warning
- 当前没有 lint 配置
- 当前不是 git monorepo 外的发布态项目，还偏本地开发形态
