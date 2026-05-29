import React from 'react'
import { MessageResponse } from '../../components/MessageResponse.js'
import { TOOL_SUMMARY_MAX_LENGTH } from '../../constants/toolLimits.js'
import { Box, Text } from '../../ink.js'
import { truncate } from '../../utils/format.js'
import type { Output, SearchResult } from './VideoSearchTool.js'

function getSearchSummary(results: (SearchResult | string)[]): {
  searchCount: number
  totalResultCount: number
} {
  let searchCount = 0
  let totalResultCount = 0

  for (const result of results) {
    if (typeof result !== 'string') {
      searchCount++
      totalResultCount += result.content?.length ?? 0
    }
  }

  return { searchCount, totalResultCount }
}

export function renderToolUseMessage(
  {
    query,
    allowed_domains,
    blocked_domains,
  }: Partial<{
    query: string
    allowed_domains?: string[]
    blocked_domains?: string[]
  }>,
  { verbose }: { verbose: boolean },
): React.ReactNode {
  if (!query) return null

  let message = `"${query}"`
  if (verbose) {
    if (allowed_domains?.length) {
      message += `, only allowing domains: ${allowed_domains.join(', ')}`
    }
    if (blocked_domains?.length) {
      message += `, blocking domains: ${blocked_domains.join(', ')}`
    }
  }
  return message
}

export function renderToolResultMessage(output: Output): React.ReactNode {
  const { searchCount } = getSearchSummary(output.results ?? [])
  const timeDisplay =
    output.durationSeconds >= 1
      ? `${Math.round(output.durationSeconds)}s`
      : `${Math.round(output.durationSeconds * 1000)}ms`

  return (
    <Box justifyContent="space-between" width="100%">
      <MessageResponse height={1}>
        <Text>
          Did {searchCount} video search
          {searchCount !== 1 ? 'es' : ''} in {timeDisplay}
        </Text>
      </MessageResponse>
    </Box>
  )
}

export function getToolUseSummary(
  input: Partial<{ query: string }> | undefined,
): string | null {
  if (!input?.query) return null
  return truncate(input.query, TOOL_SUMMARY_MAX_LENGTH)
}
