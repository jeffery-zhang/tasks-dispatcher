import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import { AgentProcessSupervisor } from "../../src/dispatching/AgentProcessSupervisor.js";

describe("AgentProcessSupervisor", () => {
  it("parses stage markers from stdout and reports raw close metadata", async () => {
    const childProcess = spawn(
      process.execPath,
      [
        "-e",
        [
          "console.log('TASKS_DISPATCHER_STAGE:plan');",
          "console.log('TASKS_DISPATCHER_STAGE:develop');",
          "console.log('TASKS_DISPATCHER_STAGE:self_check');"
        ].join("")
      ],
      { stdio: "pipe" }
    );
    const supervisor = new AgentProcessSupervisor(childProcess);
    const stages: string[] = [];

    const completion = new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
      reason: "startup_failed" | null;
    }>((resolve) => {
      supervisor.onStage((event) => {
        stages.push(event.stage);
      });
      supervisor.onExit((event) => {
        resolve(event);
      });
    });

    supervisor.start();

    expect(await completion).toEqual({
      code: 0,
      signal: null,
      reason: null
    });
    expect(stages).toEqual(["plan", "develop", "self_check"]);
  });

  it("still emits a completion declaration marker without treating it as final success", async () => {
    const childProcess = spawn(
      process.execPath,
      [
        "-e",
        [
          "console.log('TASKS_DISPATCHER_STAGE:plan');",
          "console.log('TASKS_DISPATCHER_STAGE:complete');"
        ].join("")
      ],
      { stdio: "pipe" }
    );
    const supervisor = new AgentProcessSupervisor(childProcess);
    const completionDeclarations: boolean[] = [];

    const completion = new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
      reason: "startup_failed" | null;
    }>((resolve) => {
      supervisor.onCompletionDeclared(() => {
        completionDeclarations.push(true);
      });
      supervisor.onExit((event) => {
        resolve(event);
      });
    });

    supervisor.start();

    expect(await completion).toEqual({
      code: 0,
      signal: null,
      reason: null
    });
    expect(completionDeclarations).toEqual([true]);
  });
});
