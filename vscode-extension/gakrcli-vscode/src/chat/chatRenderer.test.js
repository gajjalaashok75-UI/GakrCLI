const test = require('node:test');
const assert = require('node:assert/strict');
const { renderChatHtml } = require('./chatRenderer');

test('chat renderer uses compact collapsible tool rows by default', () => {
  const html = renderChatHtml({ nonce: 'test-nonce', platform: 'win32' });

  assert.match(html, /card\.className = 'tool-card ' \+ statusClass/);
  assert.match(html, /<span class="tool-target">/);
  assert.match(html, /card\.classList\.toggle\('expanded'\)/);
  assert.doesNotMatch(html, /card\.className = 'tool-card expanded'/);
});

test('chat renderer constrains noisy tool output and exposes readable summaries', () => {
  const html = renderChatHtml({ nonce: 'test-nonce', platform: 'linux' });

  assert.match(html, /function formatOutputForDisplay/);
  assert.match(html, /function outputSummary/);
  assert.match(html, /max-height: 220px;/);
  assert.match(html, /truncated ' \+ \(text\.length - 5000\) \+ ' chars/);
});

