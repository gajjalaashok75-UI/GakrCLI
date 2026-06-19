import assert from 'node:assert/strict'
import test from 'node:test'

import { extractGitHubRepoSlug } from './repoSlug.ts'

test('keeps owner/repo input as-is', () => {
  assert.equal(extractGitHubRepoSlug('gajjalaashok75-UI/gakrcli'), 'gajjalaashok75-UI/gakrcli')
})

test('extracts slug from https GitHub URLs', () => {
  assert.equal(
    extractGitHubRepoSlug('https://github.com/gajjalaashok75-UI/gakrcli'),
    'gajjalaashok75-UI/gakrcli',
  )
  assert.equal(
    extractGitHubRepoSlug('https://www.github.com/gajjalaashok75-UI/gakrcli.git'),
    'gajjalaashok75-UI/gakrcli',
  )
})

test('extracts slug from ssh GitHub URLs', () => {
  assert.equal(
    extractGitHubRepoSlug('git@github.com:gajjalaashok75-UI/gakrcli.git'),
    'gajjalaashok75-UI/gakrcli',
  )
  assert.equal(
    extractGitHubRepoSlug('ssh://git@github.com/gajjalaashok75-UI/gakrcli'),
    'gajjalaashok75-UI/gakrcli',
  )
})

test('rejects malformed or non-GitHub URLs', () => {
  assert.equal(extractGitHubRepoSlug('https://gitlab.com/gajjalaashok75-UI/gakrcli'), null)
  assert.equal(extractGitHubRepoSlug('https://github.com/gajjalaashok75-UI'), null)
  assert.equal(extractGitHubRepoSlug('not actually github.com/gajjalaashok75-UI/gakrcli'), null)
  assert.equal(
    extractGitHubRepoSlug('https://evil.example/?next=github.com/gajjalaashok75-UI/gakrcli'),
    null,
  )
  assert.equal(
    extractGitHubRepoSlug('https://github.com.evil.example/gajjalaashok75-UI/gakrcli'),
    null,
  )
  assert.equal(
    extractGitHubRepoSlug('https://example.com/github.com/gajjalaashok75-UI/gakrcli'),
    null,
  )
})
