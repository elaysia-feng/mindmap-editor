<script setup lang="ts">
const emit = defineEmits<{
  command: [];
  help: [];
  library: [];
  'toggle-sidebar': [];
}>();
</script>

<template>
  <header id="topbar">
    <div class="topbar-left">
      <button class="brand" type="button" title="返回文档库" aria-label="返回文档库" @click="emit('library')">
        <span class="logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.6"/><path d="M9.5 10 5 6.5M9.5 14 5 17.5M14.5 10 19 6.5M14.5 14 19 17.5"/><circle cx="4.5" cy="6" r="1.3"/><circle cx="4.5" cy="18" r="1.3"/><circle cx="19.5" cy="6" r="1.3"/><circle cx="19.5" cy="18" r="1.3"/></svg>
        </span>
        <strong>INKMAP</strong>
      </button>
      <span class="meta-divider" aria-hidden="true"></span>
      <div class="document-meta">
        <strong id="document-name">未命名脑图</strong>
        <span id="save-state" class="save-state" data-state="saved">本地已保存</span>
      </div>
    </div>

    <div class="topbar-center">
      <div class="history-controls" aria-label="历史操作">
        <button class="icon-btn" id="btn-undo" type="button" title="撤销 (Ctrl+Z)" aria-label="撤销" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v1"/></svg></button>
        <button class="icon-btn" id="btn-redo" type="button" title="重做 (Ctrl+Shift+Z)" aria-label="重做" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0-6 6v1"/></svg></button>
      </div>
    </div>

    <div class="topbar-actions">
      <div class="mode-switch" role="tablist" aria-label="编辑视图">
        <button class="mode-btn active" type="button" role="tab" aria-selected="true" data-mode="map" title="脑图视图">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="2.5"/><path d="M9.5 10 5 6.5M9.5 14 5 17.5M14.5 10 19 6.5M14.5 14 19 17.5"/></svg><span>脑图</span>
        </button>
        <button class="mode-btn" type="button" role="tab" aria-selected="false" data-mode="split" title="打开 Markdown 文字稿">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><path d="M5 5h14v14H5zM8 9l3 3-3 3M13 15h3"/></svg><span>Markdown</span>
        </button>
        <button class="mode-btn mode-markdown-only" type="button" role="tab" aria-selected="false" data-mode="markdown" title="全屏 Markdown">全文</button>
      </div>
      <button class="command-trigger" id="btn-command" type="button" title="搜索操作 (Ctrl K)" aria-label="搜索操作" @click="emit('command')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><span>搜索或输入命令</span><kbd>Ctrl K</kbd>
      </button>
      <button class="tool-btn primary compact-action" id="btn-add-root" type="button" title="新建子节点 (Tab)" aria-label="新建子节点">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>新建节点</span>
      </button>
      <details class="topbar-menu">
        <summary class="topbar-button" title="更多操作" aria-label="更多操作"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></summary>
        <div class="topbar-menu-panel">
          <button class="menu-action" id="btn-auto-layout" type="button"><span>整理当前布局</span></button>
          <button class="menu-action" id="btn-import" type="button"><span>打开 Markdown</span></button>
          <button class="menu-action" id="btn-open-json" type="button"><span>打开 JSON 备份</span></button>
          <div class="menu-divider"></div>
          <button class="menu-action" id="btn-export-md" type="button"><span>导出 Markdown</span></button>
          <button class="menu-action" id="btn-export-json" type="button"><span>导出 JSON 备份</span></button>
          <button class="menu-action" id="btn-theme" type="button"><span>切换日间 / 夜间航图</span></button>
          <button class="menu-action" type="button" @click="emit('help')"><span>快捷键与帮助</span></button>
          <div class="menu-divider"></div>
          <button class="menu-action danger" id="btn-clear" type="button"><span>清空当前脑图</span></button>
        </div>
      </details>
      <button class="icon-btn topbar-icon sidebar-toggle" type="button" title="打开导航 (Ctrl B)" aria-label="打开导航" @click="emit('toggle-sidebar')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><path d="M5 5h14v14H5zM9 9h6M9 13h4"/></svg>
      </button>
    </div>
  </header>
</template>
