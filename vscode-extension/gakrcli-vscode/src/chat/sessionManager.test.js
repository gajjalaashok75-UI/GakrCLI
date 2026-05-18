const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const {
  acquireEnvMutex,
  releaseEnvMutex,
} = require('../../../../src/entrypoints/sdk/shared.js');
const { SessionManager } = require('./sessionManager');

const originalConfigDir = process.env.GAKR_CONFIG_DIR;
let tempDir;

test.beforeEach(async () => {
  const result = await acquireEnvMutex();
  if (!result.acquired) {
    throw new Error('Timed out acquiring shared test mutation lock for VS Code session manager test');
  }

  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gakrcli-vscode-sessions-'));
  process.env.GAKR_CONFIG_DIR = tempDir;
});

test.afterEach(async () => {
  try {
    if (originalConfigDir === undefined) {
      delete process.env.GAKR_CONFIG_DIR;
    } else {
      process.env.GAKR_CONFIG_DIR = originalConfigDir;
    }

    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  } finally {
    releaseEnvMutex();
  }
});

test('SessionManager reads sessions from GAKR_CONFIG_DIR', async () => {
  const manager = new SessionManager();
  manager.setCwd('workspace-project');

  const sessionDir = path.join(tempDir, 'projects', 'workspace-project');
  await fs.mkdir(sessionDir, { recursive: true });
  await fs.writeFile(
    path.join(sessionDir, 'session-1.jsonl'),
    JSON.stringify({
      type: 'user',
      timestamp: '2026-05-18T10:00:00.000Z',
      message: { content: 'hello from GakrCLI' },
    }) + '\n',
  );

  const sessions = await manager.listSessions();

  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, 'session-1');
  assert.equal(sessions[0].preview, 'hello from GakrCLI');
  assert.equal(sessions[0].filePath, path.join(sessionDir, 'session-1.jsonl'));
});
