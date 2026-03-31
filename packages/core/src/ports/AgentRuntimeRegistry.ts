import type { AgentKind } from "../domain/AgentKind.js";

export interface AgentRuntimeRegistry {
  assertSupportedAgents(agents: AgentKind[]): void;
}
