import { describe, expect, it } from 'bun:test'
import {
  formatCoAuthorTrailer,
  parseCoAuthor,
  stripMatchingQuotes,
  USAGE,
} from './commit-message.js'

describe('commit-message command helpers', () => {
  it('parses quoted co-author names with a plain email', () => {
    expect(parseCoAuthor('"GPT 5.5" noreply@gakrcli.dev')).toEqual({
      name: 'GPT 5.5',
      email: 'noreply@gakrcli.dev',
    })
  })

  it('parses co-author trailers with angle-bracket emails', () => {
    expect(parseCoAuthor('GakrCLI (gpt-5.5) <noreply@gakrcli.dev>')).toEqual(
      {
        name: 'GakrCLI (gpt-5.5)',
        email: 'noreply@gakrcli.dev',
      },
    )
  })

  it('rejects co-author trailers with empty sanitized names', () => {
    expect(parseCoAuthor('"  " noreply@gakrcli.dev')).toBeNull()
    expect(parseCoAuthor('"  " <noreply@gakrcli.dev>')).toBeNull()
  })

  it('strips one pair of matching quotes from custom attribution text', () => {
    expect(stripMatchingQuotes('"Generated with GakrCLI"')).toBe(
      'Generated with GakrCLI',
    )
    expect(stripMatchingQuotes("'Generated with GakrCLI'")).toBe(
      'Generated with GakrCLI',
    )
    expect(stripMatchingQuotes('"Generated with GakrCLI')).toBe(
      '"Generated with GakrCLI',
    )
  })

  it('formats a sanitized co-author trailer', () => {
    expect(
      formatCoAuthorTrailer('GakrCLI <gpt>\n', '<noreply@gakrcli.dev>'),
    ).toBe('Co-Authored-By: GakrCLI gpt <noreply@gakrcli.dev>')
  })

  it('makes set scope explicit with example text', () => {
    expect(USAGE).toContain(
      'Controls only the attribution text appended after /commit messages.',
    )
    expect(USAGE).toContain(
      '/commit-message set "Generated with GakrCLI using GPT-5.5"',
    )
    expect(USAGE).not.toContain('/commit-message set-attribution')
  })
})
