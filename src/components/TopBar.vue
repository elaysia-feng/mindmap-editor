<template>
  <header id="topbar">
    <div class="brand">
      <div class="logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" />
          <circle cx="4" cy="6" r="2" />
          <circle cx="4" cy="18" r="2" />
          <circle cx="20" cy="6" r="2" />
          <circle cx="20" cy="18" r="2" />
          <path d="M12 12 L4 6 M12 12 L4 18 M12 12 L20 6 M12 12 L20 18" />
        </svg>
      </div>
      <div class="brand-text">
        <div class="brand-title">脑图编辑器</div>
        <div class="brand-sub">MindMap Studio</div>
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
        <button class="mode-btn active" type="button" role="tab" aria-selected="true" data-mode="map">脑图</button>
        <button class="mode-btn" type="button" role="tab" aria-selected="false" data-mode="markdown">Markdown</button>
        <button class="mode-btn" type="button" role="tab" aria-selected="false" data-mode="split">分屏</button>
      </div>
    </div>

    <nav class="toolbar" aria-label="文件和编辑操作">
      <button class="tool-btn" id="btn-add-root" type="button" title="新建子节点 (Tab)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
        <span>新建节点</span>
      </button>
      <button class="tool-btn" id="btn-auto-layout" type="button" title="整理布局">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="15" width="6" height="6" rx="1" /><path d="M9 6h4a2 2 0 0 1 2 2v7 M15 18h-4a2 2 0 0 1-2-2V9" /></svg>
        <span>整理布局</span>
      </button>
      <button class="tool-btn primary" id="btn-import" type="button" title="打开 Markdown 编辑模式">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3" /></svg>
        <span>Markdown</span>
      </button>
      <button class="tool-btn" id="btn-open-json" type="button" title="打开 JSON 备份">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 13h6 M9 17h6 M9 9h2" /></svg>
        <span>打开 JSON</span>
      </button>
      <button class="tool-btn" id="btn-export-md" type="button" title="导出 Markdown">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4 M17 10l-5 5-5-5 M12 15V3" /></svg>
        <span>导出 MD</span>
      </button>
      <button class="tool-btn" id="btn-export-json" type="button" title="导出 JSON 备份">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 13h6 M9 17h6 M9 9h2" /></svg>
        <span>JSON</span>
      </button>
      <button class="tool-btn" id="btn-clear" type="button" title="清空全部">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
        <span>清空</span>
      </button>
      <div class="tool-divider"></div>
      <button class="tool-btn icon-only" id="btn-theme" type="button" title="切换主题" aria-label="切换主题">
        <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><circle cx="12" cy="12" r="5" /><path d="M12 1v2 M12 21v2 M4.2 4.2l1.4 1.4 M18.4 18.4l1.4 1.4 M1 12h2 M21 12h2 M4.2 19.8l1.4-1.4 M18.4 5.6l1.4-1.4" /></svg>
        <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
      </button>
    </nav>
  </header>
</template>
