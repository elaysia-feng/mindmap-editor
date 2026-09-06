<script setup lang="ts">
const emit = defineEmits<{
  command: [];
  help: [];
  'toggle-sidebar': [];
}>();
</script>

<template>
  <header id="topbar">
    <div class="topbar-left">
      <div class="brand">
        <div class="logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="2.8" />
            <path d="M9.6 10 5.5 7M9.6 14l-4.1 3M14.4 10l4.1-3M14.4 14l4.1 3" />
            <circle cx="4.5" cy="6.3" r="1.5" /><circle cx="4.5" cy="17.7" r="1.5" />
            <circle cx="19.5" cy="6.3" r="1.5" /><circle cx="19.5" cy="17.7" r="1.5" />
          </svg>
        </div>
        <div class="brand-text">
          <strong class="brand-title">INKMAP</strong>
          <span class="brand-sub">语义工作台</span>
        </div>
      </div>
      <div class="document-meta">
        <span class="meta-divider" aria-hidden="true"></span>
        <div class="document-copy">
          <span class="document-label">当前脑图</span>
          <strong id="document-name">未命名脑图</strong>
        </div>
        <span id="save-state" class="save-state" data-state="saved">本地已保存</span>
      </div>
    </div>

    <div class="topbar-center">
      <div class="history-controls" aria-label="历史操作">
        <button class="icon-btn" id="btn-undo" type="button" title="撤销 (Ctrl+Z)" aria-label="撤销" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 6 6v1" /></svg>
        </button>
        <button class="icon-btn" id="btn-redo" type="button" title="重做 (Ctrl+Shift+Z)" aria-label="重做" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0-6 6v1" /></svg>
        </button>
      </div>
      <div class="mode-switch" role="tablist" aria-label="编辑模式">
        <button class="mode-btn active" type="button" role="tab" aria-selected="true" data-mode="map">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="2.5" /><path d="M9.5 10 5 6.5M9.5 14 5 17.5M14.5 10 19 6.5M14.5 14 19 17.5" /></svg>
          <span>脑图</span>
        </button>
        <button class="mode-btn" type="button" role="tab" aria-selected="false" data-mode="markdown">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5h14v14H5zM8 9l3 3-3 3M13 15h3" /></svg>
          <span>Markdown</span>
        </button>
        <button class="mode-btn" type="button" role="tab" aria-selected="false" data-mode="split">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="1.5" /><path d="M12 5v14" /></svg>
          <span>分屏</span>
        </button>
      </div>
    </div>

    <div class="topbar-actions">
      <button class="command-trigger" id="btn-command" type="button" title="搜索操作 (Ctrl K)" aria-label="搜索操作">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
        <span>搜索操作</span>
        <kbd>Ctrl K</kbd>
      </button>
      <button class="tool-btn primary compact-action" id="btn-add-root" type="button" title="新建子节点 (Tab)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        <span>新建节点</span>
      </button>
      <button class="tool-btn compact-action" id="btn-auto-layout" type="button" title="整理布局">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="15" width="6" height="6" rx="1" /><path d="M9 6h4a2 2 0 0 1 2 2v7M15 18h-4a2 2 0 0 1-2-2V9" /></svg>
        <span>整理</span>
      </button>
      <details class="topbar-menu">
        <summary class="topbar-button" title="文件操作">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h6l2 2h8v10a2 2 0 0 1-2 2H4z" /><path d="M4 6V4h6l2 2" /></svg>
          <span>文件</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
        </summary>
        <div class="topbar-menu-panel">
          <button class="menu-action" id="btn-import" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h6l2 2h8v14H4z" /><path d="M12 17V9M9 12l3-3 3 3" /></svg>
            <span>打开 Markdown</span>
          </button>
          <button class="menu-action" id="btn-open-json" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>
            <span>打开 JSON 备份</span>
          </button>
          <div class="menu-divider"></div>
          <button class="menu-action" id="btn-export-md" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h6l2 2h8v14H4z" /><path d="M12 9v8M9 14l3 3 3-3" /></svg>
            <span>导出 Markdown</span>
          </button>
          <button class="menu-action" id="btn-export-json" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 14h6M12 11v6" /></svg>
            <span>导出 JSON 备份</span>
          </button>
          <div class="menu-divider"></div>
          <button class="menu-action danger" id="btn-clear" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg>
            <span>清空当前脑图</span>
          </button>
        </div>
      </details>
      <button class="icon-btn topbar-icon" id="btn-theme" type="button" title="切换主题" aria-label="切换主题">
        <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.7 8.7 0 1 0 11.2 11.2Z" /></svg>
      </button>
      <button class="icon-btn topbar-icon" id="btn-help" type="button" title="快捷键指南" aria-label="快捷键指南" @click="emit('help')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.7 2.7 0 1 1 4.7 1.8c-.9.9-2.2 1.2-2.2 2.7M12 17h.01" /></svg>
      </button>
      <button class="icon-btn topbar-icon sidebar-toggle" type="button" title="切换右侧导航 (Ctrl B)" aria-label="切换右侧导航" @click="emit('toggle-sidebar')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M15 4v16M8 9h4M8 13h4" /></svg>
      </button>
    </div>
  </header>
</template>
