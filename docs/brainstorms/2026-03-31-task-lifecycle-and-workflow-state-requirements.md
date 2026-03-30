---
date: 2026-03-31
topic: task-lifecycle-and-workflow-state
---

# Task Lifecycle And Workflow State

## Problem Frame

当前系统已经把 runtime 收口、attempt 结果协议和 desktop failure visibility 跑通，但状态模型本身还沿着旧命名和旧边界在演化。现在如果不先把任务生命周期、流程模板、attempt 和步骤状态的边界钉死，后面一旦接入自定义流程、多步骤串行执行、每步不同 agent，就很容易把“任务状态”“执行状态”“流程定义”和“机器协议”混成一团。

这次 brainstorm 的目标不是讨论具体实现文件，而是先把状态定义和语义边界定清，确保下一轮 planning 不需要重新发明概念。

## Requirements

**Task Lifecycle**
- R1. 任务生命周期统一定义为 `draft -> ready -> executing -> completed -> failed -> archived`。
- R2. `reopen` 不是任务状态，而是一个显式操作；它的效果是把任务重新送回 `draft`。
- R3. 只有 `draft` 状态允许编辑任务内容。
- R4. `ready` 表示任务内容与流程快照都已冻结，任务正在等待 agent 认领。
- R5. `completed` 表示 agent 已完成任务，任务进入稳定等待态；人类后续可以选择 `reopen` 或 `archive`。
- R6. `failed` 表示当前任务失败并暂停，默认不会自动回到可执行队列；人类后续可以选择 `reopen`。
- R7. `archived` 表示生命周期结束，不再参与活跃执行流转。

**Workflow And Snapshot Semantics**
- R8. 流程是独立于任务的概念，任务在 `draft` 期间可以选择流程。
- R9. 任务进入 `ready` 时，必须冻结当前流程快照；之后流程模板的变化不影响该任务。
- R10. 任务处于 `ready` 或 `executing` 期间，不响应流程模板的后续修改。
- R11. 任务重新 `reopen -> draft` 后，允许重新选择流程或重新冻结新的流程快照。

**Attempt Model**
- R12. 每次任务进入 `executing` 时，产生一个新的 attempt。
- R13. 每个 attempt 都必须绑定自己的流程快照；旧 attempt 永远按旧快照解释，新 attempt 可以绑定新快照。
- R14. 同一个任务在任意时刻最多只允许存在一个 active attempt。
- R15. attempt 失败时，任务直接进入 `failed`；步骤级重试不是第一版状态模型的一部分。

**Step Definition And Step Runtime State**
- R16. 流程模板保存步骤定义，attempt 保存步骤运行记录；二者不是同一个对象。
- R17. 第一步版本的步骤定义收敛为最小集合：`name`、`agent`、`prompt`。
- R18. 不单独保留用户可编辑的“完成态”字段；步骤目标直接通过 prompt 表达。
- R19. 对外 UI 展示的是用户定义或默认的步骤名，例如 `plan / work / review`。
- R20. 内部状态必须把“当前步骤”与“步骤运行状态”分开建模，不能混成一个字段。
- R21. 第一步版本的步骤运行状态包含：`pending`、`running`、`completed`、`failed`、`skipped`。
- R22. `skipped` 只表示该步骤未实际执行但被明确跳过；`running -> skipped` 不允许。
- R23. 步骤失败发生在哪一步，必须作为稳定可见的执行日志与状态信息保留。

**Execution Semantics**
- R24. 当前默认流程统一定义为 `plan -> work -> review`。
- R25. 当前版本每个步骤与一个 agent 一对一。
- R26. 当前版本同一 attempt 内的步骤按顺序串行执行；系统一次只启动当前步骤对应的 agent。
- R27. 某一步成功后，应由 runtime 推进到下一步 agent，而不是依赖人类手动切换。
- R28. 正常成功路径下，当前步骤 agent 应自然退出；只有异常路径才需要 runtime 强制中止。
- R29. 一个 attempt 的所有步骤都进入终态，且没有步骤为 `failed` 时，该 attempt 才算成功。
- R30. `completed` 与 `skipped` 都是步骤可接受终态；`failed` 不是。
- R30a. 当前版本默认不支持执行中向用户发起交互问答；步骤执行应保持自主完成或自主失败。
- R30b. 系统级与步骤级 prompt 都必须明确约束 agent 不得向用户提问；当信息不足时，agent 只能按最小合理假设继续，或以明确失败原因结束当前步骤。
- R30c. 如果 agent 仍然在执行过程中产生需要用户回答的问题，runtime 不进入对话模式；该步骤与当前 attempt 必须以明确的 `needs_input` / `interaction_required` 类失败语义收口，并让任务进入 `failed`。

**Machine Protocol Boundary**
- R31. 步骤成功必须由机器判定协议决定，不能依赖 agent 的自然语言输出。
- R32. 只有“当前步骤结果有效”且“该步骤 agent 正常结束”同时满足时，runtime 才能把该步骤标记为 `completed` 并推进到下一步。
- R33. 用户可编辑的流程步骤定义不能破坏系统固定的机器执行协议。
- R34. 机器协议、步骤状态推进和下一步骤启动条件属于系统固定边界，而不是流程模板的可编辑部分。

## Success Criteria
- 看到某个任务时，人类能够区分：这是任务生命周期状态，还是某次执行的步骤进展。
- `ready` 的语义稳定且可解释：一旦进入 `ready`，任务内容和流程快照就不会再漂移。
- 同一任务历史上的多个 attempt 都能按各自当时的流程快照解释，不会被新模板污染。
- 系统不会出现“同一任务两个 active attempts 同时跑”的真相冲突。
- UI 可以只展示步骤名，但内部仍有稳定的步骤运行状态控制流。
- 后续即使引入自定义流程、每步不同 agent、多步骤串行执行，也不需要重写任务生命周期定义。
- 当前版本不会在执行步骤中临时弹出人机问答对话框；agent 需要用户输入时，会以明确失败语义收口而不是悬空等待。

## Scope Boundaries
- 这一版只定义概念边界和产品语义，不讨论具体文件、数据库结构或 API 设计。
- 当前版本默认流程固定为 `plan -> work -> review`，不要求立即交付自定义流程编辑器。
- 当前版本不引入步骤级重试、并行步骤、条件分支执行或多 active attempts。
- 当前版本不把“步骤成功条件”开放成可编辑的 runtime 机器规则。
- 当前版本不新增任务层的 `reopened` 状态。
- 当前版本不引入执行中用户问答对话框、暂停恢复会话或 human-in-the-loop orchestration。

## Key Decisions
- **`completed` 是稳定等待态，不是瞬时过站**：agent 完成后，任务等待人类选择 `reopen` 或 `archive`，这样 `completed` 与 `failed` 在生命周期上更对称。
- **`failed` 不自动回 `ready`**：失败后默认暂停，避免隐式重跑和历史混乱。
- **`reopen` 是操作，不是状态**：任务重新进入 `draft`，恢复可编辑语义，不再保留额外的 `reopened` 生命周期状态。
- **流程快照在进入 `ready` 时冻结**：这样 `ready` 才真正代表“待执行合同”，不会出现 ready 期间模板漂移。
- **一个任务同一时刻只允许一个 active attempt**：这保证任务状态、当前步骤、日志和 abort 语义始终唯一。
- **步骤定义与步骤运行记录分离**：模板是模板，attempt 记录是记录；否则历史会被模板编辑污染。
- **步骤目标并入 prompt，不保留单独“完成态”字段**：减少与机器判定状态的混淆。
- **内部两层、外部一层**：内部拆成“当前步骤”与“步骤运行状态”，外部 UI 先只展示步骤名。
- **步骤成功必须由机器协议裁决**：prompt 可变，但步骤结果判定边界不能漂。
- **执行中问答在当前版本一律禁止**：通过系统级 prompt、步骤级 prompt 和 runtime 失败收口三层约束，避免把这一版扩成暂停/恢复式交互执行系统。

## Dependencies / Assumptions
- runtime 已具备 attempt 级机器协议与 wrapper 执行边界，这使得后续把同样的边界下探到步骤级是可行的。
- 未来自定义流程时，步骤模板会继续被人类编辑，但系统的机器协议必须保持固定。
- 默认流程目前足够作为第一版状态模型的基线例子，不需要等自定义流程落地后再定义状态。

## Outstanding Questions

### Resolve Before Planning
- None.

### Deferred to Planning
- [Affects R9-R13][Technical] 任务与流程模板的冻结关系最终采用“完整快照复制”还是“版本引用 + 不可变版本记录”更合适。
- [Affects R20-R23][Technical] 步骤运行状态在 domain 模型里以扁平字段、嵌套对象还是 step record 集合表达更利于后续扩展。
- [Affects R25-R34][Technical] 步骤级机器结果协议的 envelope、校验规则和与 agent 退出码的组合判定应如何设计。
- [Affects R26-R28][Technical] runtime 如何稳定完成“上一步 agent 自然退出 -> 验证结果 -> 启动下一步骤 agent”的编排。
- [Affects R21-R22][Needs research] 第一步是否需要额外引入 `aborted` 或 `cancelled` 作为步骤运行状态，还是继续用 `failed` + reason 即可。
- [Affects R30a-R30c][Technical] runtime 应如何识别 agent 已经进入“需要用户输入”的失配路径，并将其稳定映射为统一失败原因。

## Next Steps
→ /prompts:ce-plan for structured implementation planning
