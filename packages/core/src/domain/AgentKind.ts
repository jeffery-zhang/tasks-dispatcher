export const AGENT_KINDS = ["claude-code", "codex-cli"] as const;

export type AgentKind = (typeof AGENT_KINDS)[number];

