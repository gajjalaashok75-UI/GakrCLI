/**
 * Phase 3A feasibility tests.
 *
 * These spawn the real built CLI (`dist/cli.mjs`) in `--print` mode against a
 * fake Anthropic endpoint. They prove the assumptions the panel-agent service
 * depends on: multi-turn stream-json, resume, permission round trips,
 * cancellation, concurrent MCP attachment and event translation.
 *
 * No network calls and no real credentials: the child gets a temp HOME and a
 * loopback ANTHROPIC_BASE_URL.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  HeadlessCliWorker,
  type HeadlessWorkerOptions,
  type WorkerEvent,
} from './headlessWorker.js';
import { toCliSessionId } from './cliSessionId.js';
import type { TurnResult } from './eventTranslation.js';
import { FakeAnthropic } from './__fixtures__/fakeAnthropic.js';

const ROOT = process.cwd();
const CLI_ENTRY = join(ROOT, 'dist', 'cli.mjs');
const MCP_FIXTURE = join(
  ROOT,
  'src',
  'utils',
  'gakrcliInChrome',
  'panelAgent',
  '__fixtures__',
  'fakeMcpServer.mjs',
);
const HAVE_CLI = existsSync(CLI_ENTRY);

const cleanup: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) {
    try {
      await fn();
    } catch {
      // Best-effort cleanup.
    }
  }
});

function makeHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'gakr-panel-home-'));
  mkdirSync(join(home, 'AppData', 'Roaming'), { recursive: true });
  mkdirSync(join(home, 'AppData', 'Local'), { recursive: true });
  mkdirSync(join(home, '.tmp'), { recursive: true });
  cleanup.push(() => rmSync(home, { recursive: true, force: true }));
  return home;
}

function makeCwd(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'gakr-panel-cwd-'));
  cleanup.push(() => rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}

function makeFakeApi(replies: ConstructorParameters<typeof FakeAnthropic>[0] = []) {
  const fake = new FakeAnthropic(replies);
  cleanup.push(() => fake.close());
  return fake;
}

function testEnv(home: string, baseUrl: string): NodeJS.ProcessEnv {
  const passthrough = [
    'PATH',
    'SYSTEMROOT',
    'SYSTEMDRIVE',
    'COMSPEC',
    'WINDIR',
    'PATHEXT',
    'PROGRAMDATA',
    'PROGRAMFILES',
    'PROGRAMFILES(X86)',
    'NUMBER_OF_PROCESSORS',
    'PROCESSOR_ARCHITECTURE',
    'USERNAME',
    'USER',
    'LOGNAME',
    'LANG',
    'LC_ALL',
  ];
  const env: NodeJS.ProcessEnv = {};
  for (const key of passthrough) {
    if (process.env[key]) {
      env[key] = process.env[key];
    }
  }
  const temp = join(home, '.tmp');
  return {
    ...env,
    HOME: home,
    USERPROFILE: home,
    TEMP: temp,
    TMP: temp,
    APPDATA: join(home, 'AppData', 'Roaming'),
    LOCALAPPDATA: join(home, 'AppData', 'Local'),
    ANTHROPIC_API_KEY: 'sk-ant-test-phase3a',
    ANTHROPIC_BASE_URL: baseUrl,
    GAKR_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    GAKR_CODE_DISABLE_TERMINAL_TITLE: '1',
    GAKR_SKIP_CHROME_NATIVE_HOST_REGISTRATION: '1',
    DISABLE_TELEMETRY: '1',
    DISABLE_ERROR_REPORTING: '1',
    DISABLE_AUTOUPDATER: '1',
    NO_COLOR: '1',
  };
}

function makeWorker(opts: {
  home: string;
  cwd: string;
  baseUrl: string;
  sessionId?: string;
  resume?: boolean;
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  mcpConfig?: HeadlessWorkerOptions['mcpConfig'];
  includeThinking?: boolean;
  model?: string;
}): { worker: HeadlessCliWorker; events: WorkerEvent[] } {
  const sessionId = opts.sessionId ?? randomUUID();
  const worker = new HeadlessCliWorker({
    cliEntry: CLI_ENTRY,
    execPath: 'node',
    cwd: opts.cwd,
    sessionId,
    resume: opts.resume,
    model: opts.model,
    permissionMode: opts.permissionMode,
    mcpConfig: opts.mcpConfig,
    includeThinking: opts.includeThinking,
    env: testEnv(opts.home, opts.baseUrl),
    startupTimeoutMs: 120_000,
    killGraceMs: 1_500,
  });
  const events: WorkerEvent[] = [];
  worker.onEvent(event => events.push(event));
  cleanup.push(() => worker.close());
  return { worker, events };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor<T>(
  probe: () => T | undefined,
  timeoutMs = 60_000,
  label = 'condition',
): Promise<T> {
  const started = Date.now();
  for (;;) {
    const value = probe();
    if (value !== undefined) {
      return value;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`timed out waiting for ${label}`);
    }
    await sleep(25);
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function findTranscript(home: string): string | undefined {
  // Transcripts live under <config home>/workspace/projects/<slug>/.
  const stack = [home];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(path);
      } else if (entry.name.endsWith('.jsonl')) {
        return path;
      }
    }
  }
  return undefined;
}

describe.skipIf(!HAVE_CLI)('headless CLI worker (Phase 3A)', () => {
  test(
    'streams one turn and maps text, usage and status',
    async () => {
      const fake = makeFakeApi([{ text: 'Hello from the fake API.' }]);
      const home = makeHome();
      const cwd = makeCwd();
      const { worker, events } = makeWorker({
        home,
        cwd,
        baseUrl: fake.url,
        model: 'fake-model',
      });

      const info = await worker.start();
      expect(info.cliSessionId).toBe(toCliSessionId(worker.sessionId));
      expect(info.pid).toBeGreaterThan(0);

      const result = await worker.sendTurn('Say hello');
      expect(result.isError).toBe(false);
      expect(result.resultText).toBe('Hello from the fake API.');
      expect(result.usage.inputTokens).toBe(12);
      expect(result.usage.outputTokens).toBe(7);

      const streamed = events.filter(
        event =>
          event.type === 'message' &&
          event.data.messageType === 'chat' &&
          event.data.isStreaming === true,
      );
      expect(streamed.length).toBeGreaterThan(0);

      const finals = events.filter(
        event =>
          event.type === 'message' &&
          event.data.messageType === 'chat' &&
          event.data.isFinal === true,
      );
      expect(finals).toHaveLength(1);
      const final = finals[0]!;
      if (final.type !== 'message') throw new Error('unreachable');
      expect(final.data.content).toBe('Hello from the fake API.');
      // The final block must reuse the streamed id, exactly like runner.ts.
      const streamedIds = new Set(
        streamed.map(event => (event.type === 'message' ? event.data.id : '')),
      );
      expect(streamedIds.has(final.data.id)).toBe(true);

      expect(events.some(event => event.type === 'usage')).toBe(true);
      const completed = events.filter(
        event => event.type === 'status' && event.data.status === 'completed',
      );
      expect(completed).toHaveLength(1);

      expect(fake.requests).toHaveLength(1);
      // The CLI validates model ids and silently falls back to its default for
      // unknown names, so transport plumbing is asserted on the argv instead.
      expect(worker.buildArgs()).toContain('--model');
      expect(worker.buildArgs()).toContain('fake-model');
      expect(typeof fake.requests[0]?.model).toBe('string');
    },
    180_000,
  );

  test(
    'accepts multiple turns on one long-lived process',
    async () => {
      const fake = makeFakeApi([{ text: 'reply one' }, { text: 'reply two' }]);
      const home = makeHome();
      const cwd = makeCwd();
      const { worker } = makeWorker({ home, cwd, baseUrl: fake.url });

      const info = await worker.start();
      const first = await worker.sendTurn('first question');
      const second = await worker.sendTurn('second question');
      expect(first.resultText).toBe('reply one');
      expect(second.resultText).toBe('reply two');
      expect(worker.info?.pid).toBe(info.pid);
      expect(worker.state).toBe('ready');

      expect(fake.requests).toHaveLength(2);
      const messages = fake.requests[1]?.messages as Array<{
        role: string;
        content: unknown;
      }>;
      expect(messages.some(m => m.role === 'assistant')).toBe(true);
      const serialized = JSON.stringify(messages);
      expect(serialized).toContain('first question');
      expect(serialized).toContain('reply one');
      expect(serialized).toContain('second question');
    },
    240_000,
  );

  test(
    'resumes the same conversation after the process is replaced',
    async () => {
      const fake = makeFakeApi([{ text: 'noted' }, { text: 'you said pineapples' }]);
      const home = makeHome();
      const cwd = makeCwd();
      const first = makeWorker({ home, cwd, baseUrl: fake.url });
      const info = await first.worker.start();
      await first.worker.sendTurn('Remember: pineapples');
      // Transcript persistence is asynchronous; give it a beat before the
      // graceful stop so the assertion below is not racing the writer.
      await sleep(1_000);
      await first.worker.close();

      const transcript = await waitFor(
        () => findTranscript(home),
        15_000,
        'session transcript',
      );
      const transcriptPath = transcript;
      const sizeBefore = readFileSync(transcriptPath, 'utf8').length;
      expect(sizeBefore).toBeGreaterThan(0);

      const second = makeWorker({
        home,
        cwd,
        baseUrl: fake.url,
        sessionId: first.worker.sessionId,
        resume: true,
      });
      expect(second.worker.buildArgs()).toContain('--resume');
      const resumedInfo = await second.worker.start();
      expect(resumedInfo.cliSessionId).toBe(info.cliSessionId);
      expect(resumedInfo.pid).not.toBe(info.pid);

      const result = await second.worker.sendTurn('What did I say to remember?');
      expect(result.isError).toBe(false);
      expect(fake.requests).toHaveLength(2);

      const resumedMessages = JSON.stringify(fake.requests[1]?.messages);
      expect(resumedMessages).toContain('Remember: pineapples');
      const roles = (fake.requests[1]?.messages as Array<{ role: string }>).map(
        entry => entry.role,
      );
      expect(roles).toContain('assistant');
      expect(readFileSync(transcriptPath, 'utf8')).toContain(
        'Remember: pineapples',
      );

      const grew = readFileSync(transcriptPath, 'utf8').length > sizeBefore;
      expect(grew).toBe(true);
    },
    240_000,
  );

  test(
    'round-trips a headless permission request (deny)',
    async () => {
      const home = makeHome();
      const cwd = makeCwd();
      const outside = join(home, 'outside-cwd.txt');
      const fake = makeFakeApi([
        {
          toolUse: {
            name: 'Write',
            input: { file_path: outside, content: 'should not exist' },
          },
        },
        { text: 'write was denied' },
      ]);
      const { worker, events } = makeWorker({
        home,
        cwd,
        baseUrl: fake.url,
        permissionMode: 'default',
      });

      await worker.start();
      const turnPromise = worker.sendTurn('Write a file outside the workspace');

      const permission = await waitFor(
        () =>
          events.find(
            event => event.type === 'permission_request',
          ) as Extract<WorkerEvent, { type: 'permission_request' }> | undefined,
        90_000,
        'permission request',
      );
      expect(permission.request.toolName).toBe('Write');
      expect(worker.respondPermission(permission.request.requestId, {
        behavior: 'deny',
        message: 'No writes outside the workspace',
      })).toBe(true);

      const result = await turnPromise;
      expect(result.isError).toBe(false);
      expect(existsSync(outside)).toBe(false);

      const toolResults = JSON.stringify(fake.requests.at(-1)?.messages);
      expect(toolResults).toContain('tool_result');
      expect(toolResults).toContain('"is_error":true');
      expect(toolResults.toLowerCase()).toContain(
        'no writes outside the workspace',
      );
    },
    240_000,
  );

  test(
    'honors an explicit allow decision from the extension',
    async () => {
      const home = makeHome();
      const cwd = makeCwd();
      const outside = join(home, 'approved-write.txt');
      const fake = makeFakeApi([
        {
          toolUse: {
            name: 'Write',
            input: { file_path: outside, content: 'approved by the panel' },
          },
        },
        { text: 'write approved' },
      ]);
      const { worker, events } = makeWorker({
        home,
        cwd,
        baseUrl: fake.url,
        permissionMode: 'default',
      });

      await worker.start();
      const turnPromise = worker.sendTurn('Write a file outside the workspace');
      const permission = await waitFor(
        () =>
          events.find(
            event => event.type === 'permission_request',
          ) as Extract<WorkerEvent, { type: 'permission_request' }> | undefined,
        90_000,
        'permission request',
      );
      expect(
        worker.respondPermission(permission.request.requestId, {
          behavior: 'allow',
          updatedInput: permission.request.input,
        }),
      ).toBe(true);

      const result = await turnPromise;
      expect(result.isError).toBe(false);
      expect(readFileSync(outside, 'utf8')).toBe('approved by the panel');
    },
    240_000,
  );

  test(
    'keeps tool activity when the conversation resumes',
    async () => {
      const home = makeHome();
      const cwd = makeCwd();
      const inside = join(cwd, 'resume-tool.txt');
      const fake = makeFakeApi([
        {
          toolUse: {
            name: 'Write',
            input: { file_path: inside, content: 'tool ran before resume' },
          },
        },
        { text: 'file written before resume' },
        { text: 'still here' },
      ]);
      const first = makeWorker({
        home,
        cwd,
        baseUrl: fake.url,
        permissionMode: 'acceptEdits',
      });
      await first.worker.start();
      await first.worker.sendTurn('Write the file');
      await sleep(1_000);
      await first.worker.close();

      const second = makeWorker({
        home,
        cwd,
        baseUrl: fake.url,
        sessionId: first.worker.sessionId,
        resume: true,
        permissionMode: 'acceptEdits',
      });
      await second.worker.start();
      const result = await second.worker.sendTurn('Are you still there?');
      expect(result.isError).toBe(false);

      const resumed = JSON.stringify(fake.requests.at(-1)?.messages);
      expect(resumed).toContain('"type":"tool_use"');
      expect(resumed).toContain('"type":"tool_result"');
      expect(resumed).toContain('resume-tool.txt');
    },
    300_000,
  );

  test(
    'executes a permitted tool and streams the tool_use/tool_result messages',
    async () => {
      const home = makeHome();
      const cwd = makeCwd();
      const inside = join(cwd, 'allowed.txt');
      const fake = makeFakeApi([
        {
          toolUse: {
            name: 'Write',
            input: { file_path: inside, content: 'written by the worker' },
          },
        },
        { text: 'file written' },
      ]);
      const { worker, events } = makeWorker({
        home,
        cwd,
        baseUrl: fake.url,
        // acceptEdits allows workspace writes without prompting, which is the
        // session mode the panel will normally run Apply Batch under.
        permissionMode: 'acceptEdits',
      });

      await worker.start();
      const result = await worker.sendTurn('Write the file');
      expect(result.isError).toBe(false);
      expect(readFileSync(inside, 'utf8')).toBe('written by the worker');

      const toolUse = events.find(
        event =>
          event.type === 'message' && event.data.messageType === 'tool_use',
      );
      expect(toolUse).toBeDefined();
      if (toolUse?.type === 'message') {
        expect(toolUse.data.metadata?.toolName).toBe('Write');
      }
      const toolResult = events.find(
        event =>
          event.type === 'message' && event.data.messageType === 'tool_result',
      );
      expect(toolResult).toBeDefined();
    },
    240_000,
  );

  test(
    'cancel terminates the child and leaves no orphan process',
    async () => {
      const fake = makeFakeApi([{ text: 'never arrives', delayMs: 30_000 }]);
      const home = makeHome();
      const cwd = makeCwd();
      const { worker, events } = makeWorker({ home, cwd, baseUrl: fake.url });
      const info = await worker.start();
      const pid = info.pid!;

      const turn = worker.sendTurn('this turn will be cancelled');
      // Wait until the request is actually in flight, so this cancels a
      // streaming turn rather than a starting process.
      await waitFor(
        () => (fake.requests.length >= 1 ? true : undefined),
        60_000,
        'in-flight API request',
      );

      const started = Date.now();
      const cancelled = await worker.cancel();
      expect(cancelled).toBe(true);
      const result = await turn;
      expect(result.cancelled).toBe(true);
      expect(Date.now() - started).toBeLessThan(10_000);

      await waitFor(
        () => (worker.state === 'exited' ? true : undefined),
        10_000,
        'worker exit',
      );
      expect(isAlive(pid)).toBe(false);
    },
    180_000,
  );

  test(
    'attaches an MCP server to two concurrent workers',
    async () => {
      const fake = makeFakeApi([{ text: 'one' }, { text: 'two' }]);
      const home = makeHome();
      const cwd = makeCwd();
      const logPath = join(home, 'mcp.log');
      const mcpConfig = {
        mcpServers: {
          fake: {
            type: 'stdio' as const,
            command: process.execPath,
            args: [MCP_FIXTURE, logPath],
          },
        },
      };

      const a = makeWorker({ home, cwd, baseUrl: fake.url, mcpConfig });
      const b = makeWorker({ home, cwd, baseUrl: fake.url, mcpConfig });
      const [infoA, infoB] = await Promise.all([
        a.worker.start(),
        b.worker.start(),
      ]);
      expect(infoA.cliSessionId).not.toBe(infoB.cliSessionId);

      const [ra, rb] = await Promise.all([
        a.worker.sendTurn('worker a'),
        b.worker.sendTurn('worker b'),
      ]);
      expect(ra.isError).toBe(false);
      expect(rb.isError).toBe(false);
      // Tool/MCP metadata arrives with the first turn's system/init.
      expect(a.worker.info?.serverNames).toContain('fake');
      expect(b.worker.info?.serverNames).toContain('fake');

      const lines = readFileSync(logPath, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as { event: string });
      expect(lines.filter(entry => entry.event === 'initialize').length).toBe(2);
      expect(lines.filter(entry => entry.event === 'tools/list').length).toBeGreaterThanOrEqual(2);
    },
    240_000,
  );

  test(
    'passes attachment content blocks through to the CLI request',
    async () => {
      const fake = makeFakeApi([{ text: 'image received' }]);
      const home = makeHome();
      const cwd = makeCwd();
      const { worker } = makeWorker({ home, cwd, baseUrl: fake.url });
      await worker.start();
      const onePixelPng =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

      const result = await worker.sendTurn([
        { type: 'text', text: 'describe this screenshot' },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: onePixelPng,
          },
        },
      ]);
      expect(result.isError).toBe(false);

      const messages = fake.requests[0]?.messages as Array<{
        role: string;
        content: Array<{ type: string }>;
      }>;
      const lastUser = [...messages].reverse().find(entry => entry.role === 'user');
      expect(lastUser?.content.map(block => block.type)).toContain('image');
    },
    180_000,
  );

  test(
    'runs two real Chrome MCP stdio servers concurrently',
    async () => {
      const probe = async (): Promise<string[]> => {
        const child = spawn(
          'node',
          [CLI_ENTRY, '--gakrcli-in-chrome-mcp'],
          { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
        );
        let buffer = '';
        const pending = new Map<number, (value: Record<string, unknown>) => void>();
        child.stdout.on('data', chunk => {
          buffer += String(chunk);
          let newline = buffer.indexOf('\n');
          while (newline !== -1) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            newline = buffer.indexOf('\n');
            if (!line) continue;
            try {
              const message = JSON.parse(line) as { id?: number };
              if (typeof message.id === 'number') {
                pending.get(message.id)?.(message as Record<string, unknown>);
              }
            } catch {
              // Ignore non-JSON diagnostics.
            }
          }
        });
        cleanup.push(() => {
          child.kill();
        });

        const request = (
          id: number,
          method: string,
          params: Record<string, unknown>,
        ): Promise<Record<string, unknown>> =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error(`MCP ${method} timed out`)),
              90_000,
            );
            pending.set(id, value => {
              clearTimeout(timer);
              resolve(value);
            });
            child.stdin.write(
              `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`,
            );
          });

        await request(1, 'initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'phase3a-probe', version: '1.0.0' },
        });
        child.stdin.write(
          `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
        );
        const listed = await request(2, 'tools/list', {});
        const result = listed.result as {
          tools?: Array<{ name: string }>;
        };
        return (result.tools ?? []).map(tool => tool.name);
      };

      const [toolsA, toolsB] = await Promise.all([probe(), probe()]);
      expect(toolsA).toContain('get_windows_and_tabs');
      expect(toolsB).toContain('get_windows_and_tabs');
    },
    240_000,
  );

  test(
    'rejects a non-uuid session id before any turn',
    async () => {
      const home = makeHome();
      const fake = makeFakeApi();
      const child = spawn(
        'node',
        [
          CLI_ENTRY,
          '--print',
          '--session-id',
          'web-editor-42',
          '--output-format',
          'json',
        ],
        { env: testEnv(home, fake.url), stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let stderr = '';
      child.stderr.on('data', chunk => {
        stderr += String(chunk);
      });
      const code = await new Promise<number | null>(resolve =>
        child.on('exit', resolve),
      );
      expect(code).not.toBe(0);
      expect(stderr).toContain('Invalid session ID');
      expect(fake.requests).toHaveLength(0);
    },
    120_000,
  );
});
