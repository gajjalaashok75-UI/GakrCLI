<template>
  <div class="flex flex-col gap-2">
    <!-- Root override -->
    <div class="flex items-center gap-2">
      <span class="whitespace-nowrap">Root override</span>
      <input
        :value="projectRoot"
        class="flex-1 border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
        placeholder="Optional override path; defaults to selected project workspace"
        @input="$emit('update:project-root', ($event.target as HTMLInputElement).value)"
        @change="$emit('save-root')"
      />
      <button
        class="btn-secondary !px-2 !py-1 text-[11px]"
        type="button"
        :disabled="isSavingRoot"
        @click="$emit('save-root')"
      >
        {{ isSavingRoot ? 'Saving...' : 'Save' }}
      </button>
    </div>

    <!-- CLI selection (GakrCLI is the only engine) -->
    <div class="flex items-center gap-2">
      <span class="whitespace-nowrap">CLI</span>
      <select
        :value="selectedCli"
        class="flex-1 border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
        @change="handleCliChange"
      >
        <option value="">Auto (per project / server default)</option>
        <option v-for="e in engines" :key="e.name" :value="e.name">
          {{ e.name }}
        </option>
      </select>
      <button
        class="btn-secondary !px-2 !py-1 text-[11px]"
        type="button"
        :disabled="!selectedProject || isSavingPreference"
        @click="$emit('save-preference')"
      >
        {{ isSavingPreference ? 'Saving...' : 'Save' }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { AgentProject, AgentEngineInfo } from '@gakr-gakr/mcp-chrome-shared';

defineProps<{
  projectRoot: string;
  selectedCli: string;
  engines: AgentEngineInfo[];
  selectedProject: AgentProject | null;
  isSavingRoot: boolean;
  isSavingPreference: boolean;
}>();

const emit = defineEmits<{
  'update:project-root': [value: string];
  'update:selected-cli': [value: string];
  'save-root': [];
  'save-preference': [];
}>();

function handleCliChange(event: Event): void {
  emit('update:selected-cli', (event.target as HTMLSelectElement).value);
}
</script>
