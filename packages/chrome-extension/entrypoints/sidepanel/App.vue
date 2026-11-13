<template>
  <div class="h-full w-full bg-slate-50 relative agent-theme" :data-agent-theme="currentTheme">
    <!-- The single GakrCLI terminal. Real `gakrcli --chrome` runs inside
         xterm.js over the `gakrcli --chrome-extension` terminal backend. -->
    <div class="h-full">
      <TerminalShell />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import TerminalShell from './components/TerminalShell.vue';
import { useAgentTheme } from './composables/useAgentTheme';

// Agent theme for consistent styling
const { theme: currentTheme, initTheme } = useAgentTheme();

onMounted(async () => {
  await initTheme();
});
</script>

<style scoped>
.rr-item {
  margin-bottom: 8px;
}
.rr-actions button {
  margin-left: 6px;
}
</style>
