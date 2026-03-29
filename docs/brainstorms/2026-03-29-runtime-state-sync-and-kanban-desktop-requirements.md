---
date: 2026-03-29
topic: runtime-state-sync-and-kanban-desktop
---

# Runtime State Sync And Kanban Desktop

## Problem Frame
当前 desktop 有两个不同层级的问题。

第一层是运行正确性：agent 实际已经开始执行、甚至输出已经显示任务完成，但任务对象和 current attempt 仍可能停留在 `executing / running / plan`，这会让人类无法信任系统状态，也会直接误导后续操作。

第二层是 desktop 信息架构：当前主界面同时展示创建表单、任务列表、详情面板和日志，信息密度过高，用户在主界面就被迫处理过多上下文，不适合任务看板型工作流。

这两个问题不能混做。先解决运行正确性，再做 GUI 设计调整，否则新的界面只会更清楚地展示错误状态。

## Requirements

**Phase 1: Execution Correctness**
- R1. 当 agent 进程真实结束时，任务必须自动从 `executing` 推进到最终状态，不依赖手动刷新或重启 desktop。
- R2. `current attempt` 的 `status`、`stage` 和 `terminationReason` 必须与最新执行事实一致，不能长期停留在过期值。
- R3. 如果 agent 输出阶段标记，系统必须更新 attempt stage；如果 agent 未按约定输出完整阶段标记，系统仍必须在进程结束时正确 settle 任务状态。
- R4. renderer 必须能在执行结束后看到并展示最终状态，即使实时事件链路短暂中断，也不能永久卡在旧状态。
- R5. 读取尚未生成的 log、空 log 或历史 log 时，系统不能因此把 runtime 进程打死或让后续 fetch 全部断开。

**Phase 2: Kanban Desktop**
- R6. desktop 主界面改为任务看板，按用户视角分组列展示任务，而不是按内部原始状态一列一个。
- R7. 主界面除看板本身外不展示详情、日志或创建表单等额外信息。
- R8. 主界面右上角提供 `Add Task` 按钮；点击后以弹窗形式展示任务创建表单。
- R9. 任务卡片只展示：标题、描述摘要、状态、查看详情按钮。
- R10. 卡片中的描述最多展示 3 行，超出部分以省略号截断。
- R10a. 任务卡片允许直接展示当前状态可执行的状态切换按钮，人类无需先进入详情弹窗才能执行常见状态操作。
- R10b. 任务卡片本体不承担打开详情的点击行为；只有明确点击 `Details` 按钮时才打开任务详情弹窗，以降低误触。
- R11. 当任务处于 agent 尚未接手过的状态时，详情弹窗只展示基础信息：标题、完整描述、状态、工作流、该状态允许的操作按钮。
- R12. 当任务已经有过 attempt 时，详情弹窗必须展示执行上下文：会话 ID、流程状态、历史 log、实时 log。
- R13. 如果任务有多个 attempt，详情弹窗必须允许用户理解这些 attempt 是同一任务的不同执行会话，而不是一条扁平日志。
- R14. 看板列固定为 `Draft / Ready / Running / Review / Failed / Archived` 六列，内部原始状态继续保留为系统真实状态源。
- R15. 内部状态与看板列的映射必须稳定且可解释：
  - `Draft` 映射 `initializing` 与 `reopened`
  - `Ready` 映射 `pending_execution`
  - `Running` 映射 `executing`
  - `Review` 映射 `pending_validation`
  - `Failed` 映射 `execution_failed`
  - `Archived` 映射 `archived`
- R16. 当任务已有一个或多个 session / attempt 时，任务详情弹窗首先展示历史 session 列表，每个 session 项至少展示会话 ID 与 `Details` 按钮。
- R17. 点击某个 session 的 `Details` 按钮后，系统打开二级会话详情弹窗，用于展示该 session 的状态、流程阶段、历史 log 与实时 log。
- R18. 会话详情弹窗中的日志区域默认折叠，用户手动展开后才显示日志内容。
- R19. 会话详情弹窗中的日志容器必须独立可滚动，不能把整页或整弹窗的滚动与长日志绑定在一起。
- R20. 会话详情弹窗宽度应明显大于基础任务详情弹窗，以容纳状态信息与日志查看，但仍保持单任务上下文，不演变为整页布局。
- R21. 同一看板列内的任务卡片按最近更新时间倒序排列，最近有状态变化或执行活动的任务排在更上方。

## Success Criteria
- 人类在 desktop 中观察到的任务状态，会在 agent 执行结束后自动推进到正确最终态。
- `current attempt` 信息不再长期停留在 `running / plan` 的陈旧值。
- 主界面进入后首先看到的是状态分列的任务看板，而不是表单加侧边详情的混合布局。
- 任务创建通过弹窗完成，详情查看也通过弹窗完成。
- 人类可以直接在任务卡片上执行状态切换，不必每次先打开详情弹窗。
- 人类不会因为误点卡片主体而意外进入详情弹窗。
- 对于没有 attempt 的任务，详情弹窗保持轻量；对于有 attempt 的任务，详情弹窗能提供完整执行上下文。
- 看板列数量保持稳定，不因内部状态细节暴露而让主界面变成实现细节面板。
- 同一列里最近有变化的任务会优先浮到上方，不需要人工在长列中反复寻找最新任务。
- 当任务存在多个 session 时，用户先看到 session 列表，再按需进入单个 session 的详情，而不是在一个弹窗里一次性承载所有长日志。
- 长日志不会撑爆详情弹窗，日志查看区能单独滚动且默认收起。

## Scope Boundaries
- 先处理运行正确性，再进入 GUI 重构；本轮不接受反过来的顺序。
- 不改变任务领域状态机本身的业务定义，除非证明当前 bug 来自状态机规则错误。
- 不在这一轮引入新的 workflow 系统、过滤系统、多人协作能力或复杂拖拽交互。
- 不把“主界面只显示看板”扩展成完整设计系统重写。
- 这一版不做拖拽排序、拖拽换列或其他拖拽交互。

## Key Decisions
- 先修 bug 再改 GUI：状态正确性是新界面的前置条件。
- 主界面只保留看板，创建和详情都移到弹窗：这样主界面的认知负担最低，也符合你明确给出的使用方式。
- 状态操作允许直接放在卡片上：这样主界面仍然是看板，但不牺牲常见操作效率。
- 卡片主体不绑定详情打开：为后续可能出现的拖拽交互保留空间，也能降低这一版的误触成本。
- 详情弹窗按“是否已有 attempt”分层展示，而不是所有任务都强行展示日志和会话信息。
- 看板列采用用户视角分组，而不是原始状态直出：内部状态仍是系统真相，但主界面优先服务人类理解与操作。
- 对已有 attempt 的任务，先展示 session 列表，再通过二级会话详情弹窗承载长日志与流程细节，避免一个弹窗同时塞满所有执行历史。
- 列内排序采用最近更新优先，而不是传统 FIFO 展示：看板首先服务观察与人工干预，不是纯队列监控面板。

## Dependencies / Assumptions
- 当前任务状态推进问题更可能来自 runtime / agent stdout contract / desktop refresh contract 的组合缺陷，而不是纯 renderer 样式问题。
- 当前 UI 可复用一部分任务动作和日志组件，但页面编排需要明显重做。

## Outstanding Questions

### Deferred to Planning
- [Affects R3,R4][Technical] 任务最终状态推进应优先依赖进程关闭、stdout 阶段标记、还是两者混合的状态同步策略。
- [Affects R17,R18,R19][Technical] 二级会话详情弹窗使用原生 modal、受控 dialog 还是抽屉式覆盖层来承载大宽度与独立日志滚动。

## Next Steps
→ /prompts:ce-plan for structured implementation planning
