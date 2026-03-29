import type { Clock } from "@tasks-dispatcher/core";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

