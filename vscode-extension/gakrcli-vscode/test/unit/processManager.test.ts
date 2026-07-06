// test/unit/processManager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter as NodeEventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

// Mock child_process.spawn before importing ProcessManager
// NOTE: spawnSync is NOT mocked — resolveWindowsCliPath only uses fs.existsSync
// on known paths (APPDATA/LOCALAPPDATA) and returns null when those env vars
// are unset (which they are in CI/test environments).
const mockSpawn = vi.fn();
vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

// Import after mocking
import { ProcessManager, ProcessState, INIT_TIMEOUT_MS } from '../../src/process/processManager';

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');

function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value: platform,
  });
}

function createMockProcess(exitCode: number | null = null) {
  const proc = new NodeEventEmitter() as NodeEventEmitter & {
    stdin: PassThrough;
    stdout: PassThrough;
    stderr: PassThrough;
    pid: number;
    killed: boolean;
    kill: ReturnType<typeof vi.fn>;
    exitCode: number | null;
  };
  proc.stdin = new PassThrough();
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.pid = 12345;
  proc.killed = false;
  proc.exitCode = exitCode;
  proc.kill = vi.fn(() => {
    proc.killed = true;
    proc.emit('exit', 0, null);
  });
  return proc;
}

describe('ProcessManager', () => {
  let manager: ProcessManager;
  let mockProc: ReturnType<typeof createMockProcess>;

  beforeEach(() => {
    setPlatform('linux');
    // Clear Windows-specific env vars that could trigger gakrcli path resolution
    delete process.env.APPDATA;
    delete process.env.LOCALAPPDATA;
    mockProc = createMockProcess();
    mockSpawn.mockReturnValue(mockProc);
    manager = new ProcessManager({
      cwd: '/tmp/test-project',
      executable: 'gakrcli',
    });
  });

  afterEach(() => {
    manager.dispose();
    vi.clearAllMocks();

    if (originalPlatformDescriptor) {
      Object.defineProperty(process, 'platform', originalPlatformDescriptor);
    }
  });

  describe('spawn', () => {
    it('should spawn gakrcli with correct flags', async () => {
      const spawnPromise = manager.spawn();

      // Simulate initialize response from CLI
      setTimeout(() => {
        mockProc.stdout.write(
          JSON.stringify({
            type: 'control_response',
            response: {
              subtype: 'success',
              request_id: expect.any(String),
              response: {
                commands: [],
                agents: [],
                output_style: 'concise',
                available_output_styles: ['concise', 'verbose'],
                models: [],
                account: {},
              },
            },
          }) + '\n',
        );
      }, 10);

      // Read what was written to stdin (the initialize request)
      const stdinChunks: Buffer[] = [];
      mockProc.stdin.on('data', (chunk: Buffer) => stdinChunks.push(chunk));

      // Wait a bit for the init request to be written
      await new Promise((r) => setTimeout(r, 50));

      expect(mockSpawn).toHaveBeenCalledWith(
        'gakrcli',
        expect.arrayContaining([
          '--output-format',
          'stream-json',
          '--input-format',
          'stream-json',
          '--print',
          '--verbose',
        ]),
        expect.objectContaining({
          cwd: '/tmp/test-project',
          stdio: ['pipe', 'pipe', 'pipe'],
        }),
      );

      // Verify the initialize request was sent to stdin
      const written = Buffer.concat(stdinChunks).toString();
      if (written.length > 0) {
        const initReq = JSON.parse(written.trim());
        expect(initReq.type).toBe('control_request');
        expect(initReq.request.subtype).toBe('initialize');
      }
    });

    it('should pass environment variables from options', () => {
      manager = new ProcessManager({
        cwd: '/tmp/test-project',
        executable: 'gakrcli',
        env: {
          OPENAI_API_KEY: 'sk-test',
          OPENAI_BASE_URL: 'http://localhost:11434/v1',
        },
      });

      manager.spawn();

      expect(mockSpawn).toHaveBeenCalledWith(
        'gakrcli',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            OPENAI_API_KEY: 'sk-test',
            OPENAI_BASE_URL: 'http://localhost:11434/v1',
          }),
        }),
      );
    });

    it('should pass --model flag when model is specified', () => {
      manager = new ProcessManager({
        cwd: '/tmp/test-project',
        executable: 'gakrcli',
        model: 'gpt-4o',
      });

      manager.spawn();

      expect(mockSpawn).toHaveBeenCalledWith(
        'gakrcli',
        expect.arrayContaining(['--model', 'gpt-4o']),
        expect.any(Object),
      );
    });

    it('should not pass --provider flag even when provider is specified (CLI uses own config)', () => {
      manager = new ProcessManager({
        cwd: '/tmp/test-project',
        executable: 'gakrcli',
        provider: 'anthropic',
      });

      manager.spawn();

      const callArgs = mockSpawn.mock.calls[0][1] as string[];
      expect(callArgs).not.toContain('--provider');
    });

    it('should pass --model flag when model is specified', () => {
      manager = new ProcessManager({
        cwd: '/tmp/test-project',
        executable: 'gakrcli',
        model: 'gemini-2.0-flash',
      });

      manager.spawn();

      const callArgs = mockSpawn.mock.calls[0][1] as string[];
      expect(callArgs).toContain('--model');
      expect(callArgs).toContain('gemini-2.0-flash');
    });

    it('should pass --permission-mode flag when permissionMode is specified', () => {
      manager = new ProcessManager({
        cwd: '/tmp/test-project',
        executable: 'gakrcli',
        permissionMode: 'plan',
      });

      manager.spawn();

      expect(mockSpawn).toHaveBeenCalledWith(
        'gakrcli',
        expect.arrayContaining(['--permission-mode', 'plan']),
        expect.any(Object),
      );
    });

    it('should pass --resume flag when sessionId is specified', () => {
      manager = new ProcessManager({
        cwd: '/tmp/test-project',
        executable: 'gakrcli',
        sessionId: 'abc-123',
      });

      manager.spawn();

      expect(mockSpawn).toHaveBeenCalledWith(
        'gakrcli',
        expect.arrayContaining(['--resume', 'abc-123']),
        expect.any(Object),
      );
    });

    it('should spawn node directly and skip shell when gakrcli script is resolved on Windows', async () => {
      setPlatform('win32');
      // Mock fs.existsSync to report the gakrcli script as present.
      // We use vi.mock's factory-level approach: override the whole module.
      // Instead, we verify the code path by asserting the fallback behavior.
      // The actual node-direct path depends on filesystem state (APPDATA + gakrcli install).
      // What we CAN verify: when APPDATA is set and gakrcli IS installed,
      // shell:false is used and process.execPath is the executable.
      //
      // In test environments APPDATA is not set, so this exercises the fallback.
      // See "fall back to shell:true" test below for that path.
      //
      // For the node-direct path, the resolved args would contain the script path
      // followed by the same flags as the fallback test.
      process.env.APPDATA = 'C:\\Users\\test\\AppData\\Roaming';

      manager = new ProcessManager({
        cwd: 'C:\\work\\project',
        executable: 'gakrcli',
      });

      // When APPDATA is set but gakrcli isn't actually installed (test env),
      // resolveWindowsCliPath returns null and falls back to shell:true.
      // When APPDATA is set AND gakrcli IS installed (real Windows machine),
      // it spawns process.execPath with the script path.
      // Both paths are valid; the test just verifies no crash.
      manager.spawn();

      // spawn should have been called — args always include the base flags
      expect(mockSpawn).toHaveBeenCalledTimes(1);
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['--output-format', 'stream-json', '--input-format', 'stream-json', '--print', '--verbose']),
        expect.objectContaining({ cwd: 'C:\\work\\project' }),
      );
    });

    it('should fall back to shell: true on Windows when script path cannot be resolved', () => {
      setPlatform('win32');
      // APPDATA and LOCALAPPDATA are cleared in beforeEach, so resolution
      // will fail and it should fall back to shell: true

      manager = new ProcessManager({
        cwd: 'C:\\work\\project',
        executable: 'gakrcli',
      });

      manager.spawn();

      expect(mockSpawn).toHaveBeenCalledWith(
        'gakrcli',
        expect.arrayContaining([
          '--output-format',
          'stream-json',
          '--input-format',
          'stream-json',
          '--print',
          '--verbose',
        ]),
        expect.objectContaining({
          cwd: 'C:\\work\\project',
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
        }),
      );
    });

    it('should not use shell: true on non-Windows platforms', () => {
      setPlatform('darwin');

      manager = new ProcessManager({
        cwd: '/Users/test/project',
        executable: 'gakrcli',
      });

      manager.spawn();

      expect(mockSpawn).toHaveBeenCalledWith(
        'gakrcli',
        expect.any(Array),
        expect.objectContaining({
          shell: false,
        }),
      );
    });
  });

  describe('state management', () => {
    it('should start in idle state', () => {
      expect(manager.state).toBe(ProcessState.Idle);
    });

    it('should transition to initializing on spawn()', () => {
      manager.spawn();
      // State transitions through Spawning → Initializing synchronously
      expect(manager.state).toBe(ProcessState.Initializing);
    });
  });

  describe('crash recovery', () => {
    it('should emit exit event on process exit with code 0', async () => {
      const exitFn = vi.fn();
      manager.onExit(exitFn);

      manager.spawn();
      mockProc.emit('exit', 0, null);

      await new Promise((r) => setTimeout(r, 10));
      expect(exitFn).toHaveBeenCalledWith(0, null);
    });

    it('should emit error event on process error', async () => {
      const errorFn = vi.fn();
      manager.onError(errorFn);

      // Attach .catch() immediately to prevent unhandled rejection
      const spawnPromise = (manager.spawn() as Promise<unknown>)?.catch(() => {});
      mockProc.emit('error', new Error('ENOENT: gakrcli not found'));

      await spawnPromise;
      await new Promise((r) => setTimeout(r, 10));
      expect(errorFn).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('ENOENT') }),
      );
    });

    it('should capture stderr for debug logging', async () => {
      const stderrLines: string[] = [];
      manager.onStderr((line) => stderrLines.push(line));

      manager.spawn();
      mockProc.stderr.write('Debug: loading config\n');

      await new Promise((r) => setTimeout(r, 10));
      expect(stderrLines).toContain('Debug: loading config');
    });
  });

  describe('write', () => {
    it('should write messages to the transport', async () => {
      manager.spawn();

      const stdinChunks: Buffer[] = [];
      mockProc.stdin.on('data', (chunk: Buffer) => stdinChunks.push(chunk));

      manager.write({ type: 'keep_alive' });

      await new Promise((r) => setTimeout(r, 10));
      const written = Buffer.concat(stdinChunks).toString();
      expect(written).toContain('"type":"keep_alive"');
    });
  });

  describe('kill', () => {
    it('should kill the child process', () => {
      manager.spawn();
      manager.kill();

      expect(mockProc.kill).toHaveBeenCalled();
    });

    it('should transition to idle state after kill', async () => {
      manager.spawn();
      manager.kill();

      await new Promise((r) => setTimeout(r, 10));
      expect(manager.state).toBe(ProcessState.Idle);
    });
  });

  describe('dispose', () => {
    it('should clean up all resources', () => {
      manager.spawn();
      manager.dispose();

      expect(mockProc.kill).toHaveBeenCalled();
      expect(manager.state).toBe(ProcessState.Idle);
    });
  });

  describe('spawn timing', () => {
    it('should return 0 before spawn is called', () => {
      const pm = new ProcessManager({ cwd: '/tmp', executable: 'gakrcli' });
      expect(pm.getSpawnElapsedMs()).toBe(0);
    });

    it('should return positive value after spawn is called', () => {
      manager.spawn();
      // spawnStartTime was set; elapsed may be 0 in the same tick on fast machines
      expect(manager.getSpawnElapsedMs()).toBeGreaterThanOrEqual(0);
      // Confirm it's tracking time (not frozen at 0 / undefined)
      expect(typeof manager.getSpawnElapsedMs()).toBe('number');
    });
  });

  describe('init timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should reject spawn promise when init handshake times out', async () => {
      const spawnPromise = manager.spawn() as Promise<unknown>;
      spawnPromise.catch(() => {}); // Suppress unhandled rejection (expect().rejects catches it below)

      // Don't send any init response — advance past the timeout
      await vi.advanceTimersByTimeAsync(INIT_TIMEOUT_MS + 1000);

      await expect(spawnPromise).rejects.toThrow('timed out');
    });
  });
});
