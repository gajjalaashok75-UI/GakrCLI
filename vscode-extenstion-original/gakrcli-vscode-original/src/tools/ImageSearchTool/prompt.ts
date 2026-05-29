export const IMAGE_SEARCH_TOOL_NAME = 'ImageSearch'

export function getImageSearchPrompt(): string {
  return `
- Searches the web for image references using DuckDuckGo as the primary provider
- Returns image/page links that can be cited or opened by the user
- Falls back to Firecrawl search when DuckDuckGo is unavailable
- Supports optional domain filtering (allow/block)

CRITICAL REQUIREMENT - You MUST follow this:
  - After answering the user's question, include a "Sources:" section at the end
  - In Sources, list relevant URLs as markdown hyperlinks: [Title](URL)
`
}
