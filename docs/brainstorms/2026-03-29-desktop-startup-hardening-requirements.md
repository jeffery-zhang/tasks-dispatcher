---
date: 2026-03-29
topic: desktop-startup-hardening
---

# Desktop Startup Hardening

## Problem Frame
Desktop app startup currently fails in both packaged-output validation and README-style dev startup.

The observed failures are:
- Electron window opens to a blank page because the preload script is not injected, so `window.taskBoardApi` is undefined.
- Workspace runtime bootstrap times out because the launcher resolves a runtime entrypoint that does not exist in the built desktop output.
- Failures surface as blank UI or unhandled promise rejections, which makes the app feel broken and hides the real cause.

This matters because the desktop app is the main human-facing entrypoint. If startup is unreliable, task creation, inspection, and validation are blocked before any core workflow begins.

## Requirements

**Startup Asset Resolution**
- R1. Desktop startup must resolve and load the correct preload artifact in both dev and built desktop runs.
- R2. Renderer boot must expose the expected `taskBoardApi` bridge before the task board page executes its initial data fetches.

**Workspace Runtime Bootstrap**
- R3. Desktop startup must launch or attach to a valid workspace runtime using an entrypoint that exists in the current execution mode.
- R4. Runtime bootstrap must not rely on relative paths that only work against source TypeScript files when the desktop app is running from built output.

**Failure Visibility**
- R5. If preload injection or runtime bootstrap fails, the app must surface a clear startup error state instead of showing a blank page or only logging an unhandled rejection.
- R6. Startup failures must provide enough context for a developer to identify whether the breakage is in preload loading, runtime launch, or workspace attachment.

**Regression Protection**
- R7. The repo must include at least one automated smoke check that proves desktop startup reaches a non-empty task board for a real workspace selection path.
- R8. The repo must include coverage for the desktop bootstrap path that prevents future output-name or entrypoint-path regressions from silently shipping.

## Success Criteria
- Running the desktop app against `D:\Code\test\testdir` reaches a visible task board instead of an empty renderer.
- `window.taskBoardApi` is available in the renderer when the page initializes.
- Workspace runtime startup completes without `Timed out waiting for workspace runtime to start.`
- A broken preload path or runtime entrypoint produces an explicit startup failure signal that is visible during local validation.

## Scope Boundaries
- Do not redesign task board behavior, task lifecycle rules, or workspace ownership semantics.
- Do not expand this work into packaging, updater, installer, or multi-workspace features beyond what is needed for reliable startup.
- Do not change agent execution behavior except where startup validation needs smoke coverage.

## Key Decisions
- Fix startup as a bootstrap reliability problem, not as two unrelated bugs: preload resolution and runtime launch must be hardened together because either one alone still leaves the desktop app unusable.
- Prefer one explicit resolution strategy per execution mode over scattered hardcoded relative paths.
- Add visible startup failure handling as part of the fix, not as follow-up polish, because silent failure is part of the current defect.
- Add smoke coverage that exercises the real desktop entry path, because unit coverage alone did not catch these regressions.

## Dependencies / Assumptions
- The existing single-runtime-owner model remains the intended architecture.
- `TASKS_DISPATCHER_WORKSPACE` stays a supported path for deterministic startup validation.
- Desktop startup may run in at least two modes that matter here: dev via `electron-vite` and built output validation.

## Outstanding Questions

### Deferred to Planning
- [Affects R1,R3][Technical] Should the desktop app resolve startup artifacts from one shared bootstrap helper or separate main/runtime-specific helpers?
- [Affects R7,R8][Technical] What is the lightest reliable automated smoke harness for Electron startup in this repo?

## Next Steps
→ /prompts:ce-plan for structured implementation planning
