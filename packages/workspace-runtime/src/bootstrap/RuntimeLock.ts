import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

export class RuntimeLock {
  static async acquire(runtimeRoot: string): Promise<() => void> {
    const lockPath = resolve(runtimeRoot, "launcher.lock");
    const timeoutAt = Date.now() + 5_000;

    while (Date.now() < timeoutAt) {
      try {
        mkdirSync(lockPath);

        return () => {
          rmSync(lockPath, { recursive: true, force: true });
        };
      } catch {
        await sleep(100);
      }
    }

    throw new Error("Timed out waiting for runtime launcher lock.");
  }
}

