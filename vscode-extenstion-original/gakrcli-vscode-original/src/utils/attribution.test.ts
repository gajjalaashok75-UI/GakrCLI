import { describe, expect, it } from 'bun:test'
import {
  getDefaultCommitCoAuthorEmail,
  getDefaultCommitCoAuthorName,
} from './attribution.js'

describe('getDefaultCommitCoAuthorName', () => {
  it('does not label unknown non-Gakr provider models as Opus', () => {
    expect(
      getDefaultCommitCoAuthorName({
        model: 'gpt-5.5',
        apiProvider: 'openai',
        isInternalRepo: false,
      }),
    ).toBe('GakrCLI (gpt-5.5)')
  })

  it('does not apply internal GakrCLI formatting to non-Gakr providers', () => {
    expect(
      getDefaultCommitCoAuthorName({
        model: 'gpt-5.5',
        apiProvider: 'openai',
        isInternalRepo: true,
      }),
    ).toBe('GakrCLI (gpt-5.5)')
  })

  it('keeps the codename-safe fallback for unknown first-party models', () => {
    expect(
      getDefaultCommitCoAuthorName({
        model: 'unreleased-internal-model',
        apiProvider: 'firstParty',
        isInternalRepo: false,
      }),
    ).toBe('Gakr Opus 4.6')
  })

  it('sanitizes unknown internal GakrCLI co-author names', () => {
    expect(
      getDefaultCommitCoAuthorName({
        model: 'bad\nmodel<id>',
        apiProvider: 'firstParty',
        isInternalRepo: true,
      }),
    ).toBe('GakrCLI (bad model id)')
  })

  it('does not duplicate the GakrCLI prefix for GakrCLI model names', () => {
    expect(
      getDefaultCommitCoAuthorName({
        model: 'GakrCLI-opus-4-6',
        apiProvider: 'firstParty',
        isInternalRepo: false,
      }),
    ).toBe('GakrCLI Opus 4.6')
  })

  it('uses the GakrCLI email for commit attribution across providers', () => {
    expect(getDefaultCommitCoAuthorEmail('openai')).toBe(
      'GakrCLI@gakr.com',
    )
    expect(getDefaultCommitCoAuthorEmail('firstParty')).toBe(
      'GakrCLI@gakr.com',
    )
  })
})
