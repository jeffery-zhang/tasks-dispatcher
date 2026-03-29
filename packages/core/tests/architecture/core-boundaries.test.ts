import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const coreRoot = join(process.cwd(), "packages", "core");
const coreSrcRoot = join(coreRoot, "src");

function getSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return getSourceFiles(fullPath);
    }

    return fullPath.endsWith(".ts") ? [fullPath] : [];
  });
}

describe("core package boundaries", () => {
  it("does not depend on Electron or runtime-only packages", () => {
    const packageJson = JSON.parse(
      readFileSync(join(coreRoot, "package.json"), "utf8")
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    expect(Object.keys(dependencies)).not.toContain("electron");
    expect(Object.keys(dependencies)).not.toContain("better-sqlite3");
  });

  it("does not import Node child processes or Electron in source files", () => {
    const sourceFiles = getSourceFiles(coreSrcRoot);

    for (const filePath of sourceFiles) {
      const source = readFileSync(filePath, "utf8");

      expect(source).not.toMatch(/from\s+["']electron["']/);
      expect(source).not.toMatch(/from\s+["']node:child_process["']/);
      expect(source).not.toMatch(/from\s+["']child_process["']/);
    }
  });
});

