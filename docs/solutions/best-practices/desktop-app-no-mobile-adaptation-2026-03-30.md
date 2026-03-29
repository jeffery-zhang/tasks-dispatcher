---
title: Desktop app is desktop-first, not mobile-responsive
date: 2026-03-30
category: best-practices
module: desktop
problem_type: best_practice
component: documentation
symptoms:
  - UI discussions drift toward responsive or mobile-friendly layouts
  - Board columns risk collapsing into stacked cards when the window gets narrow
  - Desktop information density becomes inconsistent because layout decisions lack a fixed constraint
root_cause: inadequate_documentation
resolution_type: documentation_update
severity: medium
tags: [desktop, mobile-adaptation, electron-ui, board-layout, fixed-width]
---

# Desktop app is desktop-first, not mobile-responsive

## Problem
This project's Electron app is meant to behave like a desktop task board, not a responsive web app. Without an explicit rule, future UI work can drift toward mobile-style collapse behavior and undermine the board-first desktop workflow.

## Symptoms
- UI feedback starts asking for responsive behavior by default
- Status columns risk collapsing or reflowing in ways that weaken the board model
- Width, spacing, and density decisions become inconsistent across iterations

## What Didn't Work
- Treating the desktop app like a normal responsive frontend leaves too much room for ambiguity.
- Deferring the decision until each UI change would force every layout discussion to revisit the same product boundary.

## Solution
Document the constraint explicitly:

- The desktop app does **not** consider mobile adaptation
- The main board remains a desktop-first column layout
- The window should keep a fixed minimum width of `1200px`
- If the window becomes narrower than that, horizontal scrolling is acceptable
- The board can use the full window width; avoid unnecessary side gutters

This is a product and layout rule, not an optional styling preference.

Related project artifacts already point in the same direction:
- [2026-03-29-runtime-state-sync-and-kanban-desktop-requirements.md](D:\Code\Projects\tasks-dispatcher\docs\brainstorms\2026-03-29-runtime-state-sync-and-kanban-desktop-requirements.md)
- [2026-03-29-003-fix-runtime-state-sync-and-kanban-desktop-plan.md](D:\Code\Projects\tasks-dispatcher\docs\plans\2026-03-29-003-fix-runtime-state-sync-and-kanban-desktop-plan.md)

## Why This Works
The primary interaction model is a multi-column Kanban board with task cards, direct status actions, and layered detail modals. That interaction model is clearer and more stable when treated as a desktop workspace with fixed structural expectations, instead of trying to flex into a mobile-first layout.

## Prevention
- For desktop UI changes, default to desktop-first decisions unless the requirements explicitly change.
- Keep the board in columns at all supported window sizes; do not collapse it into a stacked mobile layout.
- Use a minimum width guardrail of `1200px` and allow scrollbars instead of redesigning for narrow windows.
- When reviewing future UI work, reject “make it mobile responsive” as scope creep unless product requirements explicitly add mobile support.

## Related Issues
- [2026-03-29-runtime-state-sync-and-kanban-desktop-requirements.md](D:\Code\Projects\tasks-dispatcher\docs\brainstorms\2026-03-29-runtime-state-sync-and-kanban-desktop-requirements.md)
- [2026-03-29-003-fix-runtime-state-sync-and-kanban-desktop-plan.md](D:\Code\Projects\tasks-dispatcher\docs\plans\2026-03-29-003-fix-runtime-state-sync-and-kanban-desktop-plan.md)
