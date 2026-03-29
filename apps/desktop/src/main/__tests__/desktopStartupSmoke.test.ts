import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { _electron as electron } from "playwright";

const execFileAsync = promisify(execFile);
const tempDirectories: string[] = [];

interface RuntimeMetadata {
  pid: number;
}

function createWorkspaceRoot(): string {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "tasks-dispatcher-desktop-smoke-"));

  tempDirectories.push(workspaceRoot);
  return workspaceRoot;
}

async function waitFor<T>(
  producer: () => T | Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 15_000
): Promise<T> {
  const timeoutAt = Date.now() + timeoutMs;

  while (Date.now() < timeoutAt) {
    const value = await producer();

    if (predicate(value)) {
      return value;
    }

    await new Promise((resolvePromise) => {
      setTimeout(resolvePromise, 200);
    });
  }

  throw new Error("Timed out waiting for desktop startup smoke condition.");
}

afterEach(async () => {
  for (const directory of tempDirectories.splice(0)) {
    const runtimeMetadataPath = resolve(
      directory,
      ".tasks-dispatcher",
      "runtime",
      "runtime.json"
    );

    if (existsSync(runtimeMetadataPath)) {
      const metadata = JSON.parse(readFileSync(runtimeMetadataPath, "utf8")) as RuntimeMetadata;

      try {
        process.kill(metadata.pid, "SIGTERM");
      } catch {}
    }

    rmSync(directory, { recursive: true, force: true });
  }
});

describe("desktop startup smoke", () => {
  it(
    "boots the built desktop app with a real workspace and runtime bridge",
    async () => {
      const repoRoot = process.cwd();
      const workspaceRoot = createWorkspaceRoot();

      if (process.platform === "win32") {
        await execFileAsync(
          "cmd.exe",
          ["/d", "/s", "/c", "pnpm.cmd", "--filter", "@tasks-dispatcher/desktop", "build"],
          {
            cwd: repoRoot
          }
        );
      } else {
        await execFileAsync("pnpm", ["--filter", "@tasks-dispatcher/desktop", "build"], {
          cwd: repoRoot
        });
      }

      const electronPath = resolve(
        repoRoot,
        "apps/desktop/node_modules/electron/dist/electron.exe"
      );
      const appEntry = resolve(repoRoot, "apps/desktop/out/main/main.js");
      const stateSqlitePath = resolve(workspaceRoot, ".tasks-dispatcher", "state.sqlite");
      const electronApp = await electron.launch({
        executablePath: electronPath,
        args: [appEntry],
        cwd: repoRoot,
        env: {
          ...process.env,
          TASKS_DISPATCHER_WORKSPACE: workspaceRoot
        }
      });

      try {
        const page = await electronApp.firstWindow();

        await page.waitForSelector("text=Agent Task Board", { timeout: 20_000 });

        const hasBridge = await page.evaluate(
          () => typeof window.taskBoardApi !== "undefined"
        );
        await page.getByRole("button", { name: "Add Task" }).click();
        await page.getByLabel("Title").fill("Desktop smoke task");
        await page
          .getByLabel("Description")
          .fill("Smoke test task created through the built desktop app.");
        await page.getByRole("button", { name: "Create Draft" }).click();
        await page.waitForTimeout(1_500);
        const taskCountBadge = await waitFor(() => {
          return page.locator("text=Desktop smoke task").count().then((count) => `${count}`);
        }, (value) => value === "1");
        const bodyText = await page.evaluate(() => document.body.innerText);
        const databaseExists = existsSync(stateSqlitePath);

        expect(hasBridge).toBe(true);
        expect(taskCountBadge).toBe("1");
        expect(databaseExists).toBe(true);
        expect(bodyText).toContain("Agent Task Board");
        expect(bodyText).toContain("Desktop smoke task");
        expect(bodyText).not.toContain("Desktop preload failed to load");
        expect(bodyText).not.toContain("Workspace runtime failed to start");
      } finally {
        await electronApp.close();
      }
    },
    30_000
  );
});
