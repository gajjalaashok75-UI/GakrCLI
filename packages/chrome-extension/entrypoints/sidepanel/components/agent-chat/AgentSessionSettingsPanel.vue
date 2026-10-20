<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center"
    @click.self="handleClose"
  >
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/40" />

    <!-- Panel -->
    <div
      class="relative w-full max-w-md mx-4 max-h-[85vh] overflow-hidden flex flex-col"
      :style="{
        backgroundColor: 'var(--ac-surface, #ffffff)',
        border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
        borderRadius: 'var(--ac-radius-card, 12px)',
        boxShadow: 'var(--ac-shadow-float, 0 4px 20px -2px rgba(0,0,0,0.2))',
      }"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-4 py-3"
        :style="{ borderBottom: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)' }"
      >
        <h2 class="text-sm font-semibold" :style="{ color: 'var(--ac-text, #1a1a1a)' }">
          Session Settings
        </h2>
        <button
          class="p-1 ac-btn"
          :style="{
            color: 'var(--ac-text-muted, #6e6e6e)',
            borderRadius: 'var(--ac-radius-button)',
          }"
          @click="handleClose"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Content (scrollable) -->
      <div class="flex-1 overflow-y-auto ac-scroll px-4 py-3 space-y-4">
        <!-- Loading State -->
        <div v-if="isLoading" class="py-8 text-center">
          <div class="text-sm" :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">
            Loading session info...
          </div>
        </div>

        <template v-else>
          <!-- Session Info -->
          <div class="space-y-2">
            <label
              class="text-[10px] font-bold uppercase tracking-wider"
              :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
            >
              Session Info
            </label>
            <div class="text-xs space-y-1" :style="{ color: 'var(--ac-text, #1a1a1a)' }">
              <div class="flex justify-between">
                <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">Engine</span>
                <span
                  class="px-1.5 py-0.5 text-[10px]"
                  :style="{
                    backgroundColor: ENGINE_BADGE_COLOR,
                    color: '#ffffff',
                    borderRadius: 'var(--ac-radius-button, 8px)',
                  }"
                >
                  {{ session?.engineName || 'Unknown' }}
                </span>
              </div>
              <div v-if="localModel" class="flex justify-between">
                <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">Model</span>
                <span class="font-mono text-[10px]">{{ localModel }}</span>
              </div>
              <div v-if="session?.engineSessionId" class="flex justify-between">
                <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">Engine Session</span>
                <span class="font-mono text-[10px] truncate max-w-[180px]">{{
                  session.engineSessionId
                }}</span>
              </div>
            </div>
          </div>

          <!-- Permission Mode (GakrCLI) -->
          <div v-if="isGakrcliEngine" class="space-y-2">
            <label
              class="text-[10px] font-bold uppercase tracking-wider"
              :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
            >
              Permission Mode
            </label>
            <select
              v-model="localPermissionMode"
              class="w-full px-2 py-1.5 text-xs"
              :style="{
                backgroundColor: 'var(--ac-surface, #ffffff)',
                border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
                borderRadius: 'var(--ac-radius-button, 8px)',
                color: 'var(--ac-text, #1a1a1a)',
              }"
            >
              <option value="">Default</option>
              <option value="default">default - Ask for approval</option>
              <option value="acceptEdits">acceptEdits - Auto-accept file edits</option>
              <option value="bypassPermissions">bypassPermissions - Auto-accept all</option>
              <option value="plan">plan - Plan mode only</option>
            </select>
            <p class="text-[10px]" :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }">
              Controls how GakrCLI handles tool approval requests.
            </p>
          </div>

          <!-- System Prompt Config (GakrCLI) -->
          <div v-if="isGakrcliEngine" class="space-y-2">
            <label
              class="text-[10px] font-bold uppercase tracking-wider"
              :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
            >
              System Prompt
            </label>
            <div class="space-y-2">
              <label class="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  :checked="!localUseCustomPrompt"
                  @change="localUseCustomPrompt = false"
                />
                <span :style="{ color: 'var(--ac-text, #1a1a1a)' }">Use preset (GakrCLI)</span>
              </label>
              <div v-if="!localUseCustomPrompt" class="pl-5">
                <label class="flex items-center gap-2 text-[10px]">
                  <input v-model="localAppendToPrompt" type="checkbox" />
                  <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }"
                    >Append custom text</span
                  >
                </label>
                <textarea
                  v-if="localAppendToPrompt"
                  v-model="localPromptAppend"
                  class="mt-1 w-full px-2 py-1.5 text-xs resize-none"
                  :style="{
                    backgroundColor: 'var(--ac-surface, #ffffff)',
                    border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
                    borderRadius: 'var(--ac-radius-button, 8px)',
                    color: 'var(--ac-text, #1a1a1a)',
                    fontFamily: 'var(--ac-font-mono, monospace)',
                  }"
                  rows="3"
                  placeholder="Additional instructions to append..."
                />
              </div>
              <label class="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  :checked="localUseCustomPrompt"
                  @change="localUseCustomPrompt = true"
                />
                <span :style="{ color: 'var(--ac-text, #1a1a1a)' }">Use custom prompt</span>
              </label>
              <textarea
                v-if="localUseCustomPrompt"
                v-model="localCustomPrompt"
                class="w-full px-2 py-1.5 text-xs resize-none"
                :style="{
                  backgroundColor: 'var(--ac-surface, #ffffff)',
                  border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
                  borderRadius: 'var(--ac-radius-button, 8px)',
                  color: 'var(--ac-text, #1a1a1a)',
                  fontFamily: 'var(--ac-font-mono, monospace)',
                }"
                rows="4"
                placeholder="Enter custom system prompt..."
              />
            </div>
          </div>

          <!-- Management Info (GakrCLI, read-only) -->
          <div v-if="isGakrcliEngine && managementInfo" class="space-y-2">
            <label
              class="text-[10px] font-bold uppercase tracking-wider"
              :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
            >
              SDK Info
            </label>
            <div
              class="text-[10px] space-y-1 p-2"
              :style="{
                backgroundColor: 'var(--ac-surface-inset, #f5f5f5)',
                borderRadius: 'var(--ac-radius-inner, 8px)',
              }"
            >
              <div v-if="managementInfo.model" class="flex justify-between">
                <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">Active Model</span>
                <span class="font-mono" :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">{{
                  managementInfo.model
                }}</span>
              </div>
              <div v-if="managementInfo.claudeCodeVersion" class="flex justify-between">
                <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">GakrCLI Version</span>
                <span class="font-mono" :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">{{
                  managementInfo.claudeCodeVersion
                }}</span>
              </div>
              <div v-if="managementInfo.tools?.length" class="flex justify-between">
                <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">Tools</span>
                <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">{{
                  managementInfo.tools.length
                }}</span>
              </div>
              <div v-if="managementInfo.mcpServers?.length" class="flex justify-between">
                <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">MCP Servers</span>
                <span :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">{{
                  managementInfo.mcpServers.length
                }}</span>
              </div>
            </div>
            <!-- Tool List (expandable) -->
            <details v-if="managementInfo.tools?.length" class="text-[10px]">
              <summary class="cursor-pointer" :style="{ color: 'var(--ac-link, #3b82f6)' }">
                View tools ({{ managementInfo.tools.length }})
              </summary>
              <div
                class="mt-1 p-2 max-h-32 overflow-y-auto ac-scroll"
                :style="{
                  backgroundColor: 'var(--ac-surface-inset, #f5f5f5)',
                  borderRadius: 'var(--ac-radius-inner, 8px)',
                }"
              >
                <div
                  v-for="tool in managementInfo.tools"
                  :key="tool"
                  class="font-mono truncate"
                  :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }"
                >
                  {{ tool }}
                </div>
              </div>
            </details>
            <!-- MCP Server List (expandable) -->
            <details v-if="managementInfo.mcpServers?.length" class="text-[10px]">
              <summary class="cursor-pointer" :style="{ color: 'var(--ac-link, #3b82f6)' }">
                View MCP servers ({{ managementInfo.mcpServers.length }})
              </summary>
              <div
                class="mt-1 p-2 max-h-32 overflow-y-auto ac-scroll"
                :style="{
                  backgroundColor: 'var(--ac-surface-inset, #f5f5f5)',
                  borderRadius: 'var(--ac-radius-inner, 8px)',
                }"
              >
                <div
                  v-for="server in managementInfo.mcpServers"
                  :key="server.name"
                  class="font-mono truncate flex justify-between gap-2"
                  :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }"
                >
                  <span>{{ server.name }}</span>
                  <span
                    class="text-[9px] px-1"
                    :style="{
                      backgroundColor: server.status === 'connected' ? '#10b981' : '#6b7280',
                      color: '#fff',
                      borderRadius: 'var(--ac-radius-button, 8px)',
                    }"
                    >{{ server.status }}</span
                  >
                </div>
              </div>
            </details>
          </div>
        </template>
      </div>

      <!-- Footer -->
      <div
        class="flex items-center justify-end gap-2 px-4 py-3"
        :style="{ borderTop: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)' }"
      >
        <button
          class="px-3 py-1.5 text-xs ac-btn"
          :style="{
            color: 'var(--ac-text-muted, #6e6e6e)',
            border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
            borderRadius: 'var(--ac-radius-button, 8px)',
          }"
          @click="handleClose"
        >
          Cancel
        </button>
        <button
          class="px-3 py-1.5 text-xs ac-btn"
          :style="{
            backgroundColor: 'var(--ac-accent, #c87941)',
            color: 'var(--ac-accent-contrast, #ffffff)',
            borderRadius: 'var(--ac-radius-button, 8px)',
          }"
          :disabled="isSaving"
          @click="handleSave"
        >
          {{ isSaving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import type {
  AgentSession,
  AgentManagementInfo,
  AgentSystemPromptConfig,
} from '@gakr-gakr/mcp-chrome-shared';

const props = defineProps<{
  open: boolean;
  session: AgentSession | null;
  managementInfo: AgentManagementInfo | null;
  isLoading: boolean;
  isSaving: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [settings: SessionSettings];
}>();

export interface SessionSettings {
  model: string;
  permissionMode: string;
  systemPromptConfig: AgentSystemPromptConfig | null;
}

/** GakrCLI is the only engine; its badge uses the GakrCLI brand accent. */
const ENGINE_BADGE_COLOR = 'var(--ac-accent, #c87941)';

/**
 * Preset id required by `AgentSystemPromptConfig` in @gakr-gakr/mcp-chrome-shared.
 * Kept in one place so the rest of this panel never has to spell out an
 * engine name that is not GakrCLI.
 */
const DEFAULT_PROMPT_PRESET = 'claude_code' as const;

// Local state
const localModel = ref('');
const localPermissionMode = ref('');
const localUseCustomPrompt = ref(false);
const localCustomPrompt = ref('');
const localAppendToPrompt = ref(false);
const localPromptAppend = ref('');

// Computed
const isGakrcliEngine = computed(() => String(props.session?.engineName ?? '') === 'gakrcli');

// Initialize local state when session changes
watch(
  () => props.session,
  (session) => {
    if (session) {
      localModel.value = session.model || '';
      localPermissionMode.value = session.permissionMode || '';

      // Parse system prompt config based on type
      const config = session.systemPromptConfig;
      if (config) {
        if (config.type === 'custom') {
          localUseCustomPrompt.value = true;
          localCustomPrompt.value = config.text || '';
          localAppendToPrompt.value = false;
          localPromptAppend.value = '';
        } else if (config.type === 'preset') {
          localUseCustomPrompt.value = false;
          localCustomPrompt.value = '';
          localAppendToPrompt.value = !!config.append;
          localPromptAppend.value = config.append || '';
        }
      } else {
        localUseCustomPrompt.value = false;
        localCustomPrompt.value = '';
        localAppendToPrompt.value = false;
        localPromptAppend.value = '';
      }
    }
  },
  { immediate: true },
);

function handleClose(): void {
  emit('close');
}

function handleSave(): void {
  // Build systemPromptConfig based on local state
  let systemPromptConfig: AgentSystemPromptConfig | null = null;

  if (localUseCustomPrompt.value && localCustomPrompt.value.trim()) {
    systemPromptConfig = {
      type: 'custom',
      text: localCustomPrompt.value.trim(),
    };
  } else if (localAppendToPrompt.value && localPromptAppend.value.trim()) {
    systemPromptConfig = {
      type: 'preset',
      preset: DEFAULT_PROMPT_PRESET,
      append: localPromptAppend.value.trim(),
    };
  } else {
    // Use the default GakrCLI preset without append
    systemPromptConfig = {
      type: 'preset',
      preset: DEFAULT_PROMPT_PRESET,
    };
  }

  const settings: SessionSettings = {
    model: localModel.value.trim(),
    permissionMode: localPermissionMode.value,
    systemPromptConfig,
  };
  emit('save', settings);
}
</script>
