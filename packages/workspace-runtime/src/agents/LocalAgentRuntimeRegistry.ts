import type { AgentKind, AgentRuntimeRegistry } from "@tasks-dispatcher/core";
import { ClaudeCodeRuntime } from "./ClaudeCodeRuntime.js";
import { CodexCliRuntime } from "./CodexCliRuntime.js";
import type { AgentRuntime } from "./AgentRuntime.js";

export class LocalAgentRuntimeRegistry implements AgentRuntimeRegistry {
  readonly #runtimes: Map<AgentKind, AgentRuntime>;

  constructor(runtimes?: AgentRuntime[]) {
    const defaultRuntimes = runtimes ?? [
      new ClaudeCodeRuntime(),
      new CodexCliRuntime()
    ];

    this.#runtimes = new Map(defaultRuntimes.map((runtime) => [runtime.kind, runtime]));
  }

  assertSupportedAgents(agents: AgentKind[]): void {
    for (const agent of agents) {
      if (!this.#runtimes.has(agent)) {
        throw new Error(`Unsupported agent runtime "${agent}".`);
      }
    }
  }

  get(agent: AgentKind): AgentRuntime {
    const runtime = this.#runtimes.get(agent);

    if (!runtime) {
      throw new Error(`Unsupported agent runtime "${agent}".`);
    }

    return runtime;
  }
}
