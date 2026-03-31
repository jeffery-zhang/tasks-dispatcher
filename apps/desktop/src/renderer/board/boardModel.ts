import type { TaskDetailDto, TaskSummaryDto } from "@tasks-dispatcher/core/contracts";

export const BOARD_COLUMN_ORDER = [
  "draft",
  "ready",
  "running",
  "completed",
  "failed",
  "archived"
] as const;

export type BoardColumnKey = (typeof BOARD_COLUMN_ORDER)[number];

export interface BoardColumnDefinition {
  key: BoardColumnKey;
  title: string;
}

export const BOARD_COLUMNS: BoardColumnDefinition[] = [
  { key: "draft", title: "Draft" },
  { key: "ready", title: "Ready" },
  { key: "running", title: "Running" },
  { key: "completed", title: "Completed" },
  { key: "failed", title: "Failed" },
  { key: "archived", title: "Archived" }
];

export function mapTaskStateToBoardColumn(
  state: TaskSummaryDto["state"] | TaskDetailDto["state"]
): BoardColumnKey {
  switch (state) {
    case "draft":
      return "draft";
    case "ready":
      return "ready";
    case "executing":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "archived":
      return "archived";
  }
}

export function sortBoardTasks(tasks: TaskSummaryDto[]): TaskSummaryDto[] {
  return [...tasks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
