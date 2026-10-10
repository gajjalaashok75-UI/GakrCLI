import { AGENT_TOOL_NAME } from '../AgentTool/constants.js'

export const MEMORY_RECALL_TOOL_NAME = 'memory_recall'

export function getDescription(): string {
  return `Search the project's persistent memory for prior context, decisions, and facts.

  Searches the same indexed corpus that is automatically injected into your system prompt each turn: memory markdown files (memory/**/*.md) and every prior session's summary (session-memory/summary.md). Use this when the injected block did not cover what you need, when you want a deeper or differently-worded search than the automatic per-turn query, or when the user asks "what did we decide about X".

  Usage:
  - query is free text; it is tokenized into keywords and matched lexically (BM25 ranking). Short focused queries ("postgres migration rollback", "docker compose ports") work better than long prose.
  - Results are ranked best-first and grouped per source file. Each hit shows its source path and, for prior sessions, the originating session id.
  - There are no semantic/embedding matches — if a keyword does not literally appear in memory, it will not be found. Reformulate with different wording if the first attempt returns nothing.
  - Read-only and safe to call alongside other tools.
  - For broad open-ended memory exploration consider ${AGENT_TOOL_NAME} with agents instructed to read memory files directly.
`
}
