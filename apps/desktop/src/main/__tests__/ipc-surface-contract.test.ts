import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const rendererAppPath = join(
  process.cwd(),
  "apps",
  "desktop",
  "src",
  "renderer",
  "App.tsx"
);
const preloadPath = join(
  process.cwd(),
  "apps",
  "desktop",
  "src",
  "preload",
  "taskBoardApi.ts"
);

describe("desktop IPC surface", () => {
  it("keeps renderer free of Electron and runtime client imports", () => {
    const source = readFileSync(rendererAppPath, "utf8");

    expect(source).not.toMatch(/from\s+["']electron["']/);
    expect(source).not.toMatch(/@tasks-dispatcher\/workspace-runtime\/client/);
  });

  it("uses contextBridge in preload to expose a narrow API", () => {
    const source = readFileSync(preloadPath, "utf8");

    expect(source).toMatch(/contextBridge\.exposeInMainWorld/);
    expect(source).not.toMatch(/nodeIntegration/);
  });
});

