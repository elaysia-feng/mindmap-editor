<script setup lang="ts">
type SidebarTab = 'overview' | 'outline' | 'shortcuts';

const props = defineProps<{
  activeTab: SidebarTab;
  sidebarOpen: boolean;
}>();

const emit = defineEmits<{
  select: [tab: SidebarTab];
  command: [];
  help: [];
}>();
</script>

<template>
  <aside class="workspace-rail" aria-label="工作台导航">
    <div class="rail-brand" aria-label="InkMap">
      <span class="rail-brand-mark" aria-hidden="true">
        <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="14" cy="14" r="3" />
          <path d="M5 8.5 11 12M5 19.5 11 16M17 12l6-3.5M17 16l6 3.5" />
          <circle cx="4.5" cy="8" r="1.5" />
          <circle cx="4.5" cy="20" r="1.5" />
          <circle cx="23.5" cy="8" r="1.5" />
          <circle cx="23.5" cy="20" r="1.5" />
        </svg>
      </span>
      <span class="rail-brand-name">IM</span>
    </div>

    <nav class="rail-nav" aria-label="工作区">
      <button class="rail-action" :class="{ active: !props.sidebarOpen || props.activeTab === 'overview' }" type="button" title="脑图画布" aria-label="脑图画布" @click="emit('select', 'overview')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M9.5 10 5 6.5M9.5 14 5 17.5M14.5 10 19 6.5M14.5 14 19 17.5" />
          <circle cx="4" cy="6" r="1.5" /><circle cx="4" cy="18" r="1.5" /><circle cx="20" cy="6" r="1.5" /><circle cx="20" cy="18" r="1.5" />
        </svg>
        <span>画布</span>
      </button>
      <button class="rail-action" :class="{ active: props.sidebarOpen && props.activeTab === 'outline' }" type="button" title="大纲导航" aria-label="大纲导航" @click="emit('select', 'outline')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true">
          <path d="M5 6h14M5 12h10M5 18h7" />
          <circle cx="3" cy="6" r=".7" fill="currentColor" /><circle cx="3" cy="12" r=".7" fill="currentColor" /><circle cx="3" cy="18" r=".7" fill="currentColor" />
        </svg>
        <span>结构</span>
      </button>
      <button class="rail-action" :class="{ active: props.sidebarOpen && props.activeTab === 'shortcuts' }" type="button" title="快捷键指南" aria-label="快捷键指南" @click="emit('select', 'shortcuts')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 9h2M11 9h2M15 9h2M7 13h10M8 16h8" />
        </svg>
        <span>快捷键</span>
      </button>
    </nav>

    <div class="rail-footer">
      <button class="rail-action rail-command" type="button" title="搜索操作 (Ctrl K)" aria-label="搜索操作" @click="emit('command')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" />
        </svg>
        <span>搜索</span>
      </button>
      <button class="rail-action" type="button" title="帮助" aria-label="帮助" @click="emit('help')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.7 2.7 0 1 1 4.7 1.8c-.9.9-2.2 1.2-2.2 2.7M12 17h.01" />
        </svg>
        <span>帮助</span>
      </button>
    </div>
  </aside>
</template>
