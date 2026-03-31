import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import { AgentProcessSupervisor } from "../../src/dispatching/AgentProcessSupervisor.js";

describe("AgentProcessSupervisor", () => {
  it("streams stdout chunks and reports raw close metadata", async () => {
    const childProcess = spawn(
      process.execPath,
      ["-e", "console.log('hello from child')"],
      { stdio: "pipe" }
    );
    const supervisor = new AgentProcessSupervisor(childProcess);
    let output = "";

    const completion = new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
      reason: "startup_failed" | null;
    }>((resolve) => {
      supervisor.onChunk((event) => {
        output += event.chunk;
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
    expect(output).toContain("hello from child");
  });

  it("emits abort confirmation when the wrapper reports it", async () => {
    const childProcess = spawn(
      process.execPath,
      ["-e", "console.log('TASKS_DISPATCHER_ABORT_CONFIRMED')"],
      { stdio: "pipe" }
    );
    const supervisor = new AgentProcessSupervisor(childProcess);
    const abortConfirmations: boolean[] = [];

    const completion = new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
      reason: "startup_failed" | null;
    }>((resolve) => {
      supervisor.onAbortConfirmed(() => {
        abortConfirmations.push(true);
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
    expect(abortConfirmations).toEqual([true]);
  });
});
