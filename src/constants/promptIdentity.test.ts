import { afterEach, expect, test } from 'bun:test'

import { getSystemPrompt, DEFAULT_AGENT_PROMPT } from './prompts.js'
import { CLI_SYSPROMPT_PREFIXES, getCLISyspromptPrefix } from './system.js'
import { GENERAL_PURPOSE_AGENT } from '../tools/AgentTool/built-in/generalPurposeAgent.js'
import { EXPLORE_AGENT } from '../tools/AgentTool/built-in/exploreAgent.js'

const originalSimpleEnv = process.env.GAKR_CODE_SIMPLE

afterEach(() => {
  process.env.GAKR_CODE_SIMPLE = originalSimpleEnv
})

test('CLI identity prefixes describe Gakr instead of Gakr', () => {
  expect(getCLISyspromptPrefix()).toContain('Gakr')
  expect(getCLISyspromptPrefix()).not.toContain("Anthropic's official CLI for Gakr")

  for (const prefix of CLI_SYSPROMPT_PREFIXES) {
    expect(prefix).toContain('Gakr')
    expect(prefix).not.toContain("Anthropic's official CLI for Gakr")
  }
})

test('simple mode identity describes Gakr instead of Gakr', async () => {
  process.env.GAKR_CODE_SIMPLE = '1'

  const prompt = await getSystemPrompt([], 'gpt-4o')

  expect(prompt[0]).toContain('Gakr')
  expect(prompt[0]).not.toContain("Anthropic's official CLI for Gakr")
})

test('built-in agent prompts describe Gakr instead of Gakr', () => {
  expect(DEFAULT_AGENT_PROMPT).toContain('Gakr')
  expect(DEFAULT_AGENT_PROMPT).not.toContain("Anthropic's official CLI for Gakr")

  const generalPrompt = GENERAL_PURPOSE_AGENT.getSystemPrompt({
    toolUseContext: { options: {} as never },
  })
  expect(generalPrompt).toContain('Gakr')
  expect(generalPrompt).not.toContain("Anthropic's official CLI for Gakr")

  const explorePrompt = EXPLORE_AGENT.getSystemPrompt({
    toolUseContext: { options: {} as never },
  })
  expect(explorePrompt).toContain('Gakr')
  expect(explorePrompt).not.toContain("Anthropic's official CLI for Gakr")
})
