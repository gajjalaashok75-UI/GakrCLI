import assert from 'node:assert/strict'
import test from 'node:test'

import { extractGitHubRepoSlug } from './repoSlug.ts'

test('keeps owner/repo input as-is', () => {
  assert.equal(extractGitHubRepoSlug('gakrcli-gakrcli/gakrcli'), 'gakrcli-gakrcli/gakrcli')
})

test('extracts slug from https GitHub URLs', () => {
  assert.equal(
    extractGitHubRepoSlug('https://github.com/gakrcli-gakrcli/gakrcli'),
    'gakrcli-gakrcli/gakrcli',
  )
  assert.equal(
    extractGitHubRepoSlug('https://www.github.com/gakrcli-gakrcli/gakrcli.git'),
    'gakrcli-gakrcli/gakrcli',
  )
})

test('extracts slug from ssh GitHub URLs', () => {
  assert.equal(
    extractGitHubRepoSlug('git@github.com:gakrcli-gakrcli/gakrcli.git'),
    'gakrcli-gakrcli/gakrcli',
  )
  assert.equal(
    extractGitHubRepoSlug('ssh://git@github.com/gakrcli-gakrcli/gakrcli'),
    'gakrcli-gakrcli/gakrcli',
  )
})

test('rejects malformed or non-GitHub URLs', () => {
  assert.equal(extractGitHubRepoSlug('https://gitlab.com/gakrcli-gakrcli/gakrcli'), null)
  assert.equal(extractGitHubRepoSlug('https://github.com/gakrcli-gakrcli'), null)
  assert.equal(extractGitHubRepoSlug('not actually github.com/gakrcli-gakrcli/gakrcli'), null)
  assert.equal(
    extractGitHubRepoSlug('https://evil.example/?next=github.com/gakrcli-gakrcli/gakrcli'),
    null,
  )
  assert.equal(
    extractGitHubRepoSlug('https://github.com.evil.example/gakrcli-gakrcli/gakrcli'),
    null,
  )
  assert.equal(
    extractGitHubRepoSlug('https://example.com/github.com/gakrcli-gakrcli/gakrcli'),
    null,
  )
})
