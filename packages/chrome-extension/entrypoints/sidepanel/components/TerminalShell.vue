<template>
  <div class="terminal-shell agent-theme" :data-state="state">
    <div class="terminal-toolbar">
      <div class="terminal-status">
        <span class="terminal-status-dot" />
        <span class="terminal-status-label">{{ statusLabel }}</span>
        <span v-if="backendPort !== null" class="terminal-meta">:{{ backendPort }}</span>
        <span v-if="role !== null" class="terminal-meta">{{ role }}</span>
      </div>

      <div class="terminal-actions">
        <button
          class="terminal-button"
          type="button"
          title="Copy terminal selection"
          :disabled="!hasSelection"
          @click="copySelection"
        >
          Copy
        </button>
        <button class="terminal-button" type="button" title="Paste into terminal" @click="pasteClipboard">
          Paste
        </button>
        <button
          class="terminal-button"
          type="button"
          title="Reconnect to the terminal backend"
          :disabled="isBusy"
          @click="reconnect"
        >
          Reconnect
        </button>
        <button
          v-if="state === 'exited'"
          class="terminal-button terminal-button-primary"
          type="button"
          title="Start a new terminal session"
          @click="startNewSession"
        >
          New session
        </button>
      </div>
    </div>

    <div v-if="bannerMessage" class="terminal-banner" role="status">
      <span class="terminal-banner-text">{{ bannerMessage }}</span>
      <button
        v-if="state === 'error'"
        class="terminal-button terminal-button-primary"
        type="button"
        @click="reconnect"
      >
        Retry
      </button>
    </div>

    <div ref="containerRef" class="terminal-container" />
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { ClipboardAddon, BrowserClipboardProvider } from '@xterm/addon-clipboard';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
import { useTerminalBackend, type TerminalConnectionState } from '../composables/useTerminalBackend';

const containerRef = ref<HTMLElement | null>(null);
const hasSelection = ref(false);
const exitInfo = ref<string | null>(null);

let term: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let webglAddon: WebglAddon | null = null;
let resizeObserver: ResizeObserver | null = null;

const backend = useTerminalBackend({
  onOutput: (data) => {
    term?.write(data);
  },
  onHistory: (chunks) => {
    // Replay replaces whatever the terminal currently shows so a reconnect
    // does not duplicate the restored scrollback.
    term?.reset();
    chunks.forEach((chunk) => term?.write(chunk.data));
  },
  onExit: (code, signal) => {
    exitInfo.value = signal ? `signal ${signal}` : `exit code ${code ?? 'unknown'}`;
  },
  getDimensions: () => ({
    cols: term && term.cols > 0 ? term.cols : 80,
    rows: term && term.rows > 0 ? term.rows : 24,
  }),
});

const { state, errorMessage, sessionId, role, backendPort, reconnect, startNewSession } = backend;

const isBusy = computed(
  () => state.value === 'connecting' || state.value === 'discovering' || state.value === 'reconnecting',
);

const STATUS_LABELS: Record<TerminalConnectionState, string> = {
  idle: 'Idle',
  discovering: 'Looking for backend…',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  disconnected: 'Disconnected',
  exited: 'Process exited',
  error: 'Backend unavailable',
};

const statusLabel = computed(() => STATUS_LABELS[state.value]);

const bannerMessage = computed(() => {
  if (state.value === 'error') {
    return errorMessage.value ?? 'Terminal backend unavailable.';
  }
  if (state.value === 'exited') {
    return `gakrcli --chrome exited (${exitInfo.value ?? 'unknown'}).`;
  }
  if (state.value === 'reconnecting' && sessionId.value !== null) {
    return `Reconnecting to session ${sessionId.value}.`;
  }
  return null;
});

function fitTerminal(): void {
  if (!term || !fitAddon) {
    return;
  }
  const container = containerRef.value;
  if (!container || container.clientWidth === 0 || container.clientHeight === 0) {
    return;
  }
  try {
    fitAddon.fit();
  } catch {
    // Transient layout states (hidden panel) can make fit fail; the
    // ResizeObserver retries on the next layout.
  }
}

function openLink(_event: MouseEvent, uri: string): void {
  let protocol: string;
  try {
    protocol = new URL(uri).protocol;
  } catch {
    return;
  }
  if (protocol !== 'http:' && protocol !== 'https:' && protocol !== 'mailto:') {
    return;
  }
  void chrome.tabs.create({ url: uri });
}

async function copySelection(): Promise<void> {
  const selection = term?.getSelection() ?? '';
  if (selection.length === 0) {
    return;
  }
  try {
    await navigator.clipboard.writeText(selection);
    term?.clearSelection();
  } catch {
    // Clipboard permission denied - leave the selection intact.
  }
}

async function pasteClipboard(): Promise<void> {
  try {
    const text = await navigator.clipboard.readText();
    if (text.length > 0) {
      backend.sendInput(text);
    }
  } catch {
    // Clipboard permission denied - nothing to send.
  }
}

function handleKeyEvent(event: KeyboardEvent): boolean {
  if (event.type !== 'keydown' || !(event.ctrlKey || event.metaKey) || !event.shiftKey) {
    return true;
  }
  const key = event.key.toLowerCase();
  if (key === 'c') {
    void copySelection();
    return false;
  }
  if (key === 'v') {
    void pasteClipboard();
    return false;
  }
  return true;
}

onMounted(() => {
  const container = containerRef.value;
  if (!container) {
    return;
  }

  const terminal = new Terminal({
    allowProposedApi: true,
    convertEol: false,
    cursorBlink: true,
    cursorStyle: 'block',
    fontFamily:
      "'JetBrains Mono', 'Cascadia Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
    fontSize: 12,
    lineHeight: 1.1,
    macOptionIsMeta: true,
    rightClickSelectsWord: true,
    scrollback: 10000,
    theme: {
      background: '#1c1c1a',
      foreground: '#e7e5e4',
      cursor: '#d97757',
      cursorAccent: '#1c1c1a',
      selectionBackground: 'rgba(217, 119, 87, 0.35)',
      black: '#262626',
      red: '#e06c75',
      green: '#98c379',
      yellow: '#e5c07b',
      blue: '#61afef',
      magenta: '#c678dd',
      cyan: '#56b6c2',
      white: '#d4d4d4',
      brightBlack: '#7f7f7f',
      brightRed: '#ff7b86',
      brightGreen: '#b5e890',
      brightYellow: '#ffd68a',
      brightBlue: '#7cc4ff',
      brightMagenta: '#e09bff',
      brightCyan: '#6fd8e5',
      brightWhite: '#ffffff',
    },
  });
  term = terminal;

  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(new WebLinksAddon(openLink));

  try {
    terminal.loadAddon(new ClipboardAddon(undefined, new BrowserClipboardProvider()));
  } catch {
    // Clipboard addon needs a secure context; the toolbar buttons still work.
  }

  terminal.onData((data) => backend.sendInput(data));
  terminal.onResize(({ cols, rows }) => backend.resize(cols, rows));
  terminal.onSelectionChange(() => {
    hasSelection.value = terminal.hasSelection();
  });
  terminal.attachCustomKeyEventHandler(handleKeyEvent);

  terminal.open(container);
  fitTerminal();

  try {
    webglAddon = new WebglAddon();
    webglAddon.onContextLoss(() => {
      webglAddon?.dispose();
      webglAddon = null;
    });
    terminal.loadAddon(webglAddon);
  } catch {
    // WebGL unavailable (software rendering/GPU blocklist) - DOM renderer stays.
    webglAddon = null;
  }

  terminal.focus();

  resizeObserver = new ResizeObserver(() => {
    fitTerminal();
  });
  resizeObserver.observe(container);

  void backend.connect();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  webglAddon?.dispose();
  webglAddon = null;
  term?.dispose();
  term = null;
  fitAddon = null;
  // Closing the panel must not kill the PTY: dispose() only closes the socket.
  backend.dispose();
});
</script>

<style scoped>
.terminal-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--ac-surface, #ffffff);
  color: var(--ac-text, #1a1a1a);
}

.terminal-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: var(--ac-border-width, 1px) solid var(--ac-border, #e7e5e4);
  background: var(--ac-surface, #ffffff);
  flex-shrink: 0;
}

.terminal-status {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: var(--ac-text-muted, #6e6e6e);
}

.terminal-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ac-text-subtle, #a8a29e);
  flex-shrink: 0;
}

.terminal-shell[data-state='connected'] .terminal-status-dot {
  background: #22c55e;
}

.terminal-shell[data-state='connecting'] .terminal-status-dot,
.terminal-shell[data-state='discovering'] .terminal-status-dot,
.terminal-shell[data-state='reconnecting'] .terminal-status-dot {
  background: #f59e0b;
}

.terminal-shell[data-state='error'] .terminal-status-dot,
.terminal-shell[data-state='exited'] .terminal-status-dot {
  background: #ef4444;
}

.terminal-status-label {
  font-weight: 500;
  color: var(--ac-text, #1a1a1a);
  white-space: nowrap;
}

.terminal-meta {
  font-family: var(--ac-font-mono, monospace);
  font-size: 11px;
  color: var(--ac-text-subtle, #a8a29e);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terminal-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.terminal-button {
  height: 26px;
  padding: 0 10px;
  border: var(--ac-border-width, 1px) solid var(--ac-border, #e7e5e4);
  border-radius: var(--ac-radius-button, 8px);
  background: var(--ac-surface, #ffffff);
  color: var(--ac-text, #1a1a1a);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--ac-motion-fast, 120ms) ease;
}

.terminal-button:hover:not(:disabled) {
  background: var(--ac-hover-bg, #f5f5f4);
}

.terminal-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.terminal-button-primary {
  background: var(--ac-accent, #d97757);
  border-color: var(--ac-accent, #d97757);
  color: var(--ac-accent-contrast, #ffffff);
}

.terminal-button-primary:hover:not(:disabled) {
  background: var(--ac-accent-hover, #c4664a);
}

.terminal-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  background: var(--ac-surface-muted, #f5f5f4);
  border-bottom: var(--ac-border-width, 1px) solid var(--ac-border, #e7e5e4);
  font-size: 12px;
  color: var(--ac-text-muted, #6e6e6e);
  flex-shrink: 0;
}

.terminal-banner-text {
  min-width: 0;
}

.terminal-container {
  flex: 1;
  min-height: 0;
  padding: 8px 6px 4px 10px;
  overflow: hidden;
  background: #1c1c1a;
}

.terminal-container :deep(.xterm) {
  height: 100%;
}

.terminal-container :deep(.xterm-viewport) {
  background: transparent !important;
}
</style>
