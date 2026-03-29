import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DesktopBootstrapResolutionError,
  resolveDesktopBootstrapArtifacts
} from "../bootstrap/resolveDesktopBootstrapArtifacts.js";

const tempDirectories: string[] = [];

function createMainOutputRoot(): string {
  const directory = mkdtempSync(join(tmpdir(), "tasks-dispatcher-desktop-root-"));
  const mainOutputDirectory = join(directory, "apps", "desktop", "out", "main");

  tempDirectories.push(directory);
  mkdirSync(mainOutputDirectory, { recursive: true });
  return mainOutputDirectory;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("resolveDesktopBootstrapArtifacts", () => {
  it("returns stable preload and bundled runtime paths", () => {
    const mainOutputDirectory = createMainOutputRoot();
    const preloadDirectory = join(mainOutputDirectory, "..", "preload");
    const runtimeSourceDirectory = join(
      mainOutputDirectory,
      "..",
      "..",
      "..",
      "..",
      "packages",
      "workspace-runtime",
      "src",
      "server"
    );

    mkdirSync(preloadDirectory, { recursive: true });
    mkdirSync(runtimeSourceDirectory, { recursive: true });
    writeFileSync(join(preloadDirectory, "taskBoardApi.js"), "module.exports = {};\n", "utf8");
    writeFileSync(
      join(runtimeSourceDirectory, "runtimeServerMain.ts"),
      "export {};\n",
      "utf8"
    );

    const artifacts = resolveDesktopBootstrapArtifacts(mainOutputDirectory);

    expect(artifacts.preloadPath).toMatch(/taskBoardApi\.js$/);
    expect(artifacts.runtimeLaunchTarget).toEqual({
      entryPath: join(runtimeSourceDirectory, "runtimeServerMain.ts"),
      executablePath: "node",
      mode: "tsx-source"
    });
  });

  it("throws a structured preload error when the preload artifact is missing", () => {
    const mainOutputDirectory = createMainOutputRoot();
    const runtimeSourceDirectory = join(
      mainOutputDirectory,
      "..",
      "..",
      "..",
      "..",
      "packages",
      "workspace-runtime",
      "src",
      "server"
    );

    mkdirSync(runtimeSourceDirectory, { recursive: true });
    writeFileSync(
      join(runtimeSourceDirectory, "runtimeServerMain.ts"),
      "export {};\n",
      "utf8"
    );

    expect(() => resolveDesktopBootstrapArtifacts(mainOutputDirectory)).toThrowError(
      DesktopBootstrapResolutionError
    );

    try {
      resolveDesktopBootstrapArtifacts(mainOutputDirectory);
    } catch (error) {
      expect(error).toBeInstanceOf(DesktopBootstrapResolutionError);
      expect((error as DesktopBootstrapResolutionError).code).toBe("preload_missing");
      expect((error as DesktopBootstrapResolutionError).expectedPath).toMatch(
        /taskBoardApi\.js$/
      );
    }
  });
});
