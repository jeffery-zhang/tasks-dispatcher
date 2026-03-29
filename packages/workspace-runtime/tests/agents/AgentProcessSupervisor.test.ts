import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import { AgentProcessSupervisor } from "../../src/dispatching/AgentProcessSupervisor.js";

describe("AgentProcessSupervisor", () => {
  it("parses stage markers from stdout and reports clean completion", async () => {
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

    const completion = new Promise<string>((resolve) => {
      supervisor.onStage((event) => {
        stages.push(event.stage);
      });
      supervisor.onExit((event) => {
        resolve(event.reason);
      });
    });

    supervisor.start();

    expect(await completion).toBe("completed");
    expect(stages).toEqual(["plan", "develop", "self_check"]);
  });
});
