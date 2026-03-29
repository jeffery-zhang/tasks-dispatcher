import type { AgentKind } from "../domain/AgentKind.js";

export interface AgentRuntimeRegistry {
  assertSupported(agent: AgentKind): void;
}

