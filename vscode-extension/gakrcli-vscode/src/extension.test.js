const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mock } = require('bun:test');
const {
  acquireEnvMutex,
  releaseEnvMutex,
} = require('../../../src/entrypoints/sdk/shared.js');

test.beforeEach(async () => {
  const result = await acquireEnvMutex();
  if (!result.acquired) {
    throw new Error('Timed out acquiring shared test mutation lock for VS Code extension test');
  }
});

test.afterEach(() => {
  try {
    mock.restore();
  } finally {
    releaseEnvMutex();
  }
});

function createStatus(overrides = {}) {
  return {
    installed: true,
    executable: 'gakrcli',
    launchCommand: 'gakrcli --project-aware',
    terminalName: 'gakrCLI',
    shimEnabled: false,
    workspaceFolder: '/workspace/gakrcli/very/long/path/example-project',
    workspaceSourceLabel: 'active editor workspace',
    launchCwd: '/workspace/gakrcli/very/long/path/example-project',
    launchCwdLabel: '/workspace/gakrcli/very/long/path/example-project',
    canLaunchInWorkspaceRoot: true,
    profileStatusLabel: 'Found',
    profileStatusHint: '/workspace/gakrcli/very/long/path/example-project/.gakrcli-profile.json',
    workspaceProfilePath: '/workspace/gakrcli/very/long/path/example-project/.gakrcli-profile.json',
    profileSourceLabel: 'workspace profile',
    providerState: {
      label: 'Codex',
      detail: 'gpt-5.4',
      source: 'profile',
    },
    providerSourceLabel: 'saved profile',
    ...overrides,
  };
}

function loadExtension() {
  const extensionPath = require.resolve('./extension');
  delete require.cache[extensionPath];
  mock.module('vscode', () => ({
    workspace: {
      workspaceFolders: [],
      getConfiguration: () => ({
        get: (_key, fallback) => fallback,
      }),
      getWorkspaceFolder: () => null,
    },
    window: {
      activeTextEditor: null,
      createWebviewPanel: () => ({}),
      registerWebviewViewProvider: () => ({ dispose() {} }),
      showInformationMessage: async () => undefined,
      showErrorMessage: async () => undefined,
    },
    env: {
      openExternal: async () => true,
    },
    commands: {
      registerCommand: () => ({ dispose() {} }),
      executeCommand: async () => undefined,
    },
    Uri: { parse: value => value, file: value => value },
    ViewColumn: { Active: 1 },
  }));
  return require('./extension');
}

test('renderControlCenterHtml uses the gakrCLI wordmark, status rail, and warm action hierarchy', () => {
  const { renderControlCenterHtml } = loadExtension();
  const html = renderControlCenterHtml(createStatus(), { nonce: 'test-nonce', platform: 'win32' });

  assert.match(html, /<span class="wordmark-accent">GakrCLI<\/span>/);
  assert.match(html, /class="status-rail"/);
  assert.match(html, /\.sunset-gradient\s*\{/);
  assert.match(html, /class="action-button primary" id="launch"/);
  assert.match(html, /class="action-button secondary" id="launchRoot"/);
  assert.match(
    html,
    /title="\/workspace\/gakrcli\/very\/long\/path\/example-project"[^>]*>\/workspace\/gakrcli\/very\/long\/path\/example-project<\//,
  );
});

test('readProfileState prefers the workspace profile before the global fallback', () => {
  const { readProfileState } = loadExtension();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gakrcli-vscode-profile-'));
  const workspace = path.join(root, 'workspace');
  const home = path.join(root, 'home');
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(path.join(home, '.gakrcli'), { recursive: true });
  fs.writeFileSync(
    path.join(workspace, '.gakrcli-profile.json'),
    JSON.stringify({ profile: 'xai', env: { OPENAI_MODEL: 'workspace-model' } }),
  );
  fs.writeFileSync(
    path.join(home, '.gakrcli', '.gakrcli-profile.json'),
    JSON.stringify({ profile: 'minimax', env: { OPENAI_MODEL: 'global-model' } }),
  );

  try {
    const state = readProfileState({ workspaceFolder: workspace, env: {}, homeDir: home });

    assert.equal(state.statusLabel, 'Found');
    assert.equal(state.sourceLabel, 'workspace profile');
    assert.equal(state.profile.profile, 'xai');
    assert.match(state.statusHint, /Workspace profile:/);
    assert.equal(state.filePath, path.join(workspace, '.gakrcli-profile.json'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('readProfileState falls back to ~/.gakrcli profile when workspace profile is absent', () => {
  const { readProfileState } = loadExtension();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gakrcli-vscode-global-profile-'));
  const workspace = path.join(root, 'workspace');
  const home = path.join(root, 'home');
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(path.join(home, '.gakrcli'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.gakrcli', '.gakrcli-profile.json'),
    JSON.stringify({ profile: 'xai', env: { OPENAI_MODEL: 'grok-4.3' } }),
  );

  try {
    const state = readProfileState({ workspaceFolder: workspace, env: {}, homeDir: home });

    assert.equal(state.statusLabel, 'Found');
    assert.equal(state.sourceLabel, 'global profile');
    assert.equal(state.profile.profile, 'xai');
    assert.match(state.statusHint, /Global profile:/);
    assert.equal(state.filePath, path.join(home, '.gakrcli', '.gakrcli-profile.json'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('readProfileState honors GAKR_CONFIG_DIR for the global profile fallback', () => {
  const { readProfileState } = loadExtension();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gakrcli-vscode-config-dir-profile-'));
  const workspace = path.join(root, 'workspace');
  const configDir = path.join(root, 'custom-config');
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, '.gakrcli-profile.json'),
    JSON.stringify({ profile: 'nvidia-nim', env: { OPENAI_MODEL: 'z-ai/glm-5.1' } }),
  );

  try {
    const state = readProfileState({
      workspaceFolder: workspace,
      env: { GAKR_CONFIG_DIR: configDir },
      homeDir: path.join(root, 'home'),
    });

    assert.equal(state.statusLabel, 'Found');
    assert.equal(state.sourceLabel, 'global profile');
    assert.equal(state.profile.profile, 'nvidia-nim');
    assert.equal(state.filePath, path.join(configDir, '.gakrcli-profile.json'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('renderControlCenterHtml shows explicit disabled and empty states when workspace data is missing', () => {
  const { renderControlCenterHtml } = loadExtension();
  const html = renderControlCenterHtml(
    createStatus({
      workspaceFolder: null,
      workspaceSourceLabel: 'no workspace open',
      launchCwd: null,
      launchCwdLabel: 'VS Code default terminal cwd',
      canLaunchInWorkspaceRoot: false,
      profileStatusLabel: 'Missing',
      profileStatusHint: '.gakrcli-profile.json not found at ~/.gakrcli/.gakrcli-profile.json',
      workspaceProfilePath: null,
    }),
    { nonce: 'test-nonce', platform: 'linux' },
  );

  assert.match(
    html,
    /class="action-button secondary" id="launchRoot"[^>]*disabled[^>]*>[\s\S]*Open a workspace folder to enable workspace-root launch/,
  );
  assert.match(html, /No provider profile found/);
  assert.match(html, /\.gakrcli-profile\.json not found at ~\/\.gakrcli\/\.gakrcli-profile\.json/);
  assert.doesNotMatch(html, /id="openProfile"/);
});

test('gakrCLIControlCenterProvider.getHtml supplies a nonce to the redesigned renderer', () => {
  const { GakrCLIControlCenterProvider } = loadExtension();
  const provider = new GakrCLIControlCenterProvider();

  assert.doesNotThrow(() => provider.getHtml(createStatus()));

  const html = provider.getHtml(createStatus());
  assert.match(html, /script-src 'nonce-[^']+'/);
  assert.match(html, /<script nonce="[^"]+">/);
  assert.doesNotMatch(html, /nonce-undefined/);
  assert.doesNotMatch(html, /<script nonce="undefined">/);
});

test('resolveLaunchTargets distinguishes project-aware launch from workspace-root launch', () => {
  const { resolveLaunchTargets } = loadExtension();

  assert.deepEqual(
    resolveLaunchTargets({
      activeFilePath: '/workspace/gakrcli/src/panels/control-center.js',
      workspacePath: '/workspace/gakrcli',
      workspaceSourceLabel: 'active editor workspace',
    }),
    {
      projectAwareCwd: '/workspace/gakrcli/src/panels',
      projectAwareCwdLabel: '/workspace/gakrcli/src/panels',
      projectAwareSourceLabel: 'active file directory',
      workspaceRootCwd: '/workspace/gakrcli',
      workspaceRootCwdLabel: '/workspace/gakrcli',
      launchActionsShareTarget: false,
      launchActionsShareTargetReason: null,
    },
  );
});

test('resolveLaunchTargets anchors relative launch commands to the workspace root', () => {
  const { resolveLaunchTargets } = loadExtension();

  assert.deepEqual(
    resolveLaunchTargets({
      executable: './node_modules/.bin/gakrcli',
      activeFilePath: '/workspace/gakrcli/src/panels/control-center.js',
      workspacePath: '/workspace/gakrcli',
      workspaceSourceLabel: 'active editor workspace',
    }),
    {
      projectAwareCwd: '/workspace/gakrcli',
      projectAwareCwdLabel: '/workspace/gakrcli',
      projectAwareSourceLabel: 'workspace root (required by relative launch command)',
      workspaceRootCwd: '/workspace/gakrcli',
      workspaceRootCwdLabel: '/workspace/gakrcli',
      launchActionsShareTarget: true,
      launchActionsShareTargetReason: 'relative-launch-command',
    },
  );
});

test('resolveLaunchTargets ignores active files outside the selected workspace', () => {
  const { resolveLaunchTargets } = loadExtension();

  assert.deepEqual(
    resolveLaunchTargets({
      executable: 'gakrcli',
      activeFilePath: '/tmp/notes/scratch.js',
      workspacePath: '/workspace/gakrcli',
      workspaceSourceLabel: 'first workspace folder',
    }),
    {
      projectAwareCwd: '/workspace/gakrcli',
      projectAwareCwdLabel: '/workspace/gakrcli',
      projectAwareSourceLabel: 'first workspace folder',
      workspaceRootCwd: '/workspace/gakrcli',
      workspaceRootCwdLabel: '/workspace/gakrcli',
      launchActionsShareTarget: true,
      launchActionsShareTargetReason: null,
    },
  );
});

test('renderControlCenterHtml restores landmark and heading semantics', () => {
  const { renderControlCenterHtml } = loadExtension();
  const html = renderControlCenterHtml(createStatus(), { nonce: 'test-nonce', platform: 'win32' });

  assert.match(html, /<main class="shell" aria-labelledby="control-center-title">/);
  assert.match(html, /<header class="hero">/);
  assert.match(html, /<h1 class="headline-title" id="control-center-title">/);
  assert.match(html, /<section class="modules" aria-label="Control center details">/);
  assert.match(html, /<h2 class="module-title" id="section-project">Project<\/h2>/);
  assert.match(html, /<section class="actions-layout" aria-label="Control center actions">/);
});

test('renderControlCenterHtml explains distinct launch targets when an active file directory is available', () => {
  const { renderControlCenterHtml } = loadExtension();
  const html = renderControlCenterHtml(
    createStatus({
      launchCwd: '/workspace/gakrcli/src/panels',
      launchCwdLabel: '/workspace/gakrcli/src/panels',
      launchCwdSourceLabel: 'active file directory',
      workspaceRootCwd: '/workspace/gakrcli',
      workspaceRootCwdLabel: '/workspace/gakrcli',
    }),
    { nonce: 'test-nonce', platform: 'linux' },
  );

  assert.match(html, /Starts beside the active file · \/workspace\/gakrcli\/src\/panels/);
  assert.match(html, /Always starts at the workspace root · \/workspace\/gakrcli/);
});

test('renderControlCenterHtml makes shared workspace-root launches explicit for relative commands', () => {
  const { renderControlCenterHtml } = loadExtension();
  const html = renderControlCenterHtml(
    createStatus({
      launchCwd: '/workspace/gakrcli',
      launchCwdLabel: '/workspace/gakrcli',
      launchCwdSourceLabel: 'workspace root (required by relative launch command)',
      workspaceRootCwd: '/workspace/gakrcli',
      workspaceRootCwdLabel: '/workspace/gakrcli',
      launchActionsShareTarget: true,
      launchActionsShareTargetReason: 'relative-launch-command',
    }),
    { nonce: 'test-nonce', platform: 'linux' },
  );

  assert.match(html, /Project-aware launch is anchored to the workspace root by the relative command · \/workspace\/gakrcli/);
  assert.match(html, /Same workspace-root target as Launch GakrCLI because the relative command resolves from the workspace root · \/workspace\/gakrcli/);
});

test('renderControlCenterHtml escapes hostile text and title values', () => {
  const { renderControlCenterHtml } = loadExtension();
  const html = renderControlCenterHtml(
    createStatus({
      launchCommand: '<img src=x onerror="boom()">',
      workspaceFolder: '"/><script>workspace()</script>',
      workspaceSourceLabel: 'active <b>workspace</b>',
      launchCwdLabel: '"><script>cwd()</script>',
      profileStatusHint: '<svg onload="profile()">',
      workspaceProfilePath: '"/><script>profile-path()</script>',
      providerState: {
        label: 'Provider "><img src=x onerror="label()">',
        detail: '<script>provider-detail()</script>',
        source: 'profile',
      },
    }),
    { nonce: 'test-nonce', platform: 'linux' },
  );

  assert.match(html, /&lt;img src=x onerror=&quot;boom\(\)&quot;&gt;/);
  assert.match(html, /&quot;\/&gt;&lt;script&gt;workspace\(\)&lt;\/script&gt;/);
  assert.match(html, /active &lt;b&gt;workspace&lt;\/b&gt;/);
  assert.match(html, /&lt;svg onload=&quot;profile\(\)&quot;&gt;/);
  assert.match(html, /Provider &quot;&gt;&lt;img src=x onerror=&quot;label\(\)&quot;&gt;/);
  assert.match(html, /&lt;script&gt;provider-detail\(\)&lt;\/script&gt; · saved profile/);
  assert.doesNotMatch(html, /<script>workspace\(\)<\/script>/);
  assert.doesNotMatch(html, /<img src=x onerror="boom\(\)">/);
});
