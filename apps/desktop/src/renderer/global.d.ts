import type { TaskBoardApi } from "../preload/taskBoardApi.js";

declare global {
  interface Window {
    taskBoardApi: TaskBoardApi;
  }
}

export {};
