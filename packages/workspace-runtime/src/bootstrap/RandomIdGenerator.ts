import { randomUUID } from "node:crypto";
import type { IdGenerator } from "@tasks-dispatcher/core";

export class RandomIdGenerator implements IdGenerator {
  next(prefix: string): string {
    return `${prefix}-${randomUUID()}`;
  }
}

