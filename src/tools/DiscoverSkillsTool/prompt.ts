export const DISCOVER_SKILLS_TOOL_NAME = 'DiscoverSkills'

export const DESCRIPTION =
  'Search for relevant skills by describing what you want to do'

export const DISCOVER_SKILLS_PROMPT = `Search for skills relevant to a task description. Returns matching skills ranked by relevance.

Use this when:
- The auto-surfaced skills don't cover your current task
- You're pivoting to a different kind of work mid-conversation
- You want to find specialized skills for an unusual workflow

Matching is deterministic and keyword-trigger based: a skill matches when one
of its \`triggers:\` keywords — or its name — appears in the description as a
whole token. Matching skills are also surfaced automatically each turn.`
