<template>
  <div
    v-if="open"
    class="fixed top-12 left-4 right-4 z-50 py-2 max-w-[calc(100%-2rem)]"
    :style="{
      backgroundColor: 'var(--ac-surface, #ffffff)',
      border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
      borderRadius: 'var(--ac-radius-inner, 8px)',
      boxShadow: 'var(--ac-shadow-float, 0 4px 20px -2px rgba(0,0,0,0.1))',
    }"
  >
    <!-- Projects Section -->
    <div
      class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
      :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
    >
      Projects
    </div>

    <!-- Project List -->
    <div class="max-h-[200px] overflow-y-auto ac-scroll">
      <button
        v-for="p in projects"
        :key="p.id"
        class="w-full px-3 py-2 text-left text-sm flex items-center justify-between ac-menu-item"
        :style="{
          color:
            selectedProjectId === p.id ? 'var(--ac-accent, #c87941)' : 'var(--ac-text, #1a1a1a)',
        }"
        @click="$emit('project:select', p.id)"
      >
        <div class="flex-1 min-w-0">
          <div class="truncate">{{ p.name }}</div>
          <div
            class="text-[10px] truncate"
            :style="{
              fontFamily: 'var(--ac-font-mono, monospace)',
              color: 'var(--ac-text-subtle, #a8a29e)',
            }"
          >
            {{ p.rootPath }}
          </div>
        </div>
        <svg
          v-if="selectedProjectId === p.id"
          class="w-4 h-4 flex-shrink-0 ml-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </button>
    </div>

    <!-- New Project -->
    <button
      class="w-full px-3 py-2 text-left text-sm ac-menu-item"
      :style="{ color: 'var(--ac-link, #3b82f6)' }"
      :disabled="isPicking"
      @click="$emit('project:new')"
    >
      {{ isPicking ? 'Selecting...' : '+ New Project' }}
    </button>

    <!-- Divider -->
    <div
      class="my-2"
      :style="{ borderTop: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)' }"
    />

    <!-- CLI & Model Settings -->
    <div
      class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
      :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
    >
      Settings
    </div>

    <!-- CLI Selection -->
    <div class="px-3 py-2 flex items-center gap-2">
      <span class="text-xs w-12" :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }"> CLI </span>
      <select
        :value="selectedCli"
        class="flex-1 px-2 py-1 text-xs rounded"
        :style="{
          backgroundColor: 'var(--ac-surface-muted, #f2f0eb)',
          border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
          color: 'var(--ac-text, #1a1a1a)',
          borderRadius: 'var(--ac-radius-button, 8px)',
        }"
        @change="handleCliChange"
      >
        <option value="">Auto</option>
        <option v-for="e in engines" :key="e.name" :value="e.name">
          {{ e.name }}
        </option>
      </select>
    </div>

    <!-- Chrome MCP Option -->
    <div v-if="showChromeMcpOption" class="px-3 py-2 flex items-center gap-2">
      <span class="text-xs w-12" :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }"> MCP </span>
      <label
        class="flex items-center gap-2 cursor-pointer"
        title="Enable local Chrome MCP server integration"
      >
        <input
          type="checkbox"
          :checked="enableChromeMcp"
          class="w-4 h-4 rounded"
          :style="{
            accentColor: 'var(--ac-accent, #c87941)',
          }"
          @change="handleChromeMcpChange"
        />
        <span class="text-xs" :style="{ color: 'var(--ac-text, #1a1a1a)' }">
          Enable Chrome MCP Server
        </span>
      </label>
    </div>

    <!-- Save Button -->
    <div class="px-3 py-2">
      <button
        class="w-full px-3 py-1.5 text-xs rounded transition-colors hover:opacity-90 cursor-pointer"
        :style="{
          backgroundColor: 'var(--ac-accent, #c87941)',
          color: 'var(--ac-accent-contrast, #ffffff)',
          borderRadius: 'var(--ac-radius-button, 8px)',
        }"
        :disabled="isSaving"
        @click="handleSave"
      >
        {{ isSaving ? 'Saving...' : 'Save Settings' }}
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="px-3 py-1 text-[10px]" :style="{ color: 'var(--ac-danger, #dc2626)' }">
      {{ error }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { AgentProject, AgentEngineInfo } from '@gakr-gakr/mcp-chrome-shared';

const props = defineProps<{
  open: boolean;
  projects: AgentProject[];
  selectedProjectId: string;
  selectedCli: string;
  enableChromeMcp: boolean;
  engines: AgentEngineInfo[];
  isPicking: boolean;
  isSaving: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  'project:select': [projectId: string];
  'project:new': [];
  'cli:update': [cli: string];
  'chrome-mcp:update': [enableChromeMcp: boolean];
  save: [];
}>();

// Chrome MCP option is always shown since gakrcli is the only engine
const showChromeMcpOption = computed(() => true);

function handleCliChange(event: Event): void {
  emit('cli:update', (event.target as HTMLSelectElement).value);
}

function handleChromeMcpChange(event: Event): void {
  emit('chrome-mcp:update', (event.target as HTMLInputElement).checked);
}

function handleSave(): void {
  emit('save');
}
</script>
