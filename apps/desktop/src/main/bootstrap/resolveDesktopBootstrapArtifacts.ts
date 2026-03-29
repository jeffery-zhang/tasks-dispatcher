import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { RuntimeLaunchTarget } from "@tasks-dispatcher/workspace-runtime/client";

type DesktopBootstrapResolutionErrorCode =
  | "preload_missing"
  | "runtime_entry_missing";

export class DesktopBootstrapResolutionError extends Error {
  code: DesktopBootstrapResolutionErrorCode;
  expectedPath: string;

  constructor(
    code: DesktopBootstrapResolutionErrorCode,
    expectedPath: string,
    message: string
  ) {
    super(message);
    this.name = "DesktopBootstrapResolutionError";
    this.code = code;
    this.expectedPath = expectedPath;
  }
}

export interface DesktopBootstrapArtifacts {
  preloadPath: string;
  runtimeLaunchTarget: RuntimeLaunchTarget;
}

export function resolveDesktopBootstrapArtifacts(
  mainOutputDirectory: string
): DesktopBootstrapArtifacts {
  const preloadPath = resolve(mainOutputDirectory, "../preload/taskBoardApi.js");

  if (!existsSync(preloadPath)) {
    throw new DesktopBootstrapResolutionError(
      "preload_missing",
      preloadPath,
      `Missing desktop preload artifact at ${preloadPath}.`
    );
  }

  const runtimeEntryPath = resolve(
    mainOutputDirectory,
    "../../../../packages/workspace-runtime/src/server/runtimeServerMain.ts"
  );

  if (!existsSync(runtimeEntryPath)) {
    throw new DesktopBootstrapResolutionError(
      "runtime_entry_missing",
      runtimeEntryPath,
      `Missing desktop runtime entry artifact at ${runtimeEntryPath}.`
    );
  }

  return {
    preloadPath,
    runtimeLaunchTarget: {
      entryPath: runtimeEntryPath,
      executablePath: "node",
      mode: "tsx-source"
    }
  };
}
