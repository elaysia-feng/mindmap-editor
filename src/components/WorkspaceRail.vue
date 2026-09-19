<script setup lang="ts">
type SidebarTab = 'overview' | 'outline' | 'shortcuts';
defineProps<{ activeTab: SidebarTab; sidebarOpen: boolean }>();
const emit = defineEmits<{ select: [tab: SidebarTab]; command: []; help: [] }>();
</script>

<template>
  <nav class="workspace-rail" aria-label="画布快捷入口">
    <button class="rail-action rail-navigator" :class="{ active: sidebarOpen }" type="button" title="打开结构导航" aria-label="打开结构导航" @click="emit('select', 'outline')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><path d="M5 6h14M5 12h10M5 18h7"/><circle cx="3" cy="6" r=".7" fill="currentColor"/><circle cx="3" cy="12" r=".7" fill="currentColor"/><circle cx="3" cy="18" r=".7" fill="currentColor"/></svg>
      <span>导航</span>
    </button>
    <button class="rail-action rail-command" type="button" title="搜索操作" aria-label="搜索操作" @click="emit('command')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><span>命令</span>
    </button>
    <button class="rail-action rail-help" type="button" title="帮助" aria-label="帮助" @click="emit('help')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.7 2.7 0 1 1 4.7 1.8c-.9.9-2.2 1.2-2.2 2.7M12 17h.01"/></svg><span>帮助</span>
    </button>
  </nav>
</template>
