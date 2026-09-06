<template>
  <footer id="statusbar">
    <div class="status-left">
      <span id="status-info">双击空白处新建节点 · 双击节点编辑 · 拖拽移动 · 滚轮缩放 · Space+拖拽平移</span>
    </div>
    <div class="status-right">
      <span id="zoom-info">100%</span>
      <span class="dot">·</span>
      <span id="node-info">0 个节点</span>
    </div>
  </footer>

  <div id="floating-actions">
    <button class="fab" id="fab-fit" type="button" title="可读适配 (F)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V5a2 2 0 0 1 2-2h4 M15 3h4a2 2 0 0 1 2 2v4 M21 15v4a2 2 0 0 1-2 2h-4 M9 21H5a2 2 0 0 1-2-2v-4" /></svg>
    </button>
    <div class="zoom-controls">
      <button class="zoom-btn" id="zoom-out" type="button" title="缩小">−</button>
      <button class="zoom-btn reset" id="zoom-reset" type="button" title="重置视图">⌖</button>
      <button class="zoom-btn" id="zoom-in" type="button" title="放大">+</button>
    </div>
  </div>

  <input id="md-file-input" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden />
  <input id="json-file-input" type="file" accept=".json,application/json" hidden />

  <div id="context-menu" class="context-menu hidden">
    <div class="ctx-item" data-action="add-child" role="menuitem" tabindex="0">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
      <span>添加子节点</span>
      <em>Tab</em>
    </div>
    <div class="ctx-item" data-action="add-sibling" role="menuitem" tabindex="0">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M5 12h14 M12 5v14" /></svg>
      <span>添加同级节点</span>
      <em>Enter</em>
    </div>
    <div class="ctx-item" data-action="edit" role="menuitem" tabindex="0">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
      <span>编辑</span>
      <em>F2</em>
    </div>
    <div class="ctx-divider"></div>
    <div class="ctx-item" data-action="collapse" role="menuitem" tabindex="0">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M6 9l6 6 6-6" /></svg>
      <span>折叠 / 展开</span>
      <em>Space</em>
    </div>
    <div class="ctx-item ctx-danger" data-action="delete" role="menuitem" tabindex="0">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
      <span>删除节点</span>
      <em>Del</em>
    </div>
  </div>

  <div id="drag-hint" class="drag-hint hidden">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4 M12 16h.01" /></svg>
    <span>松开鼠标挂到目标节点下</span>
  </div>

  <div id="node-picker" class="node-picker hidden" role="dialog" aria-label="添加节点">
    <div class="node-picker-title">添加节点</div>
    <div class="node-picker-subtitle">节点会自动接到这根连线上</div>
    <input id="node-picker-input" type="text" maxlength="80" placeholder="输入节点名称" aria-label="节点名称" />
    <div class="node-picker-actions">
      <button id="node-picker-cancel" type="button" class="ghost">取消</button>
      <button id="node-picker-create" type="button">创建节点</button>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>

  <div id="node-toolbar" class="node-toolbar hidden">
    <button class="node-tool-btn" type="button" data-action="link" data-tip="从此处拉出连线">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
    </button>
    <button class="node-tool-btn" type="button" data-action="add-sibling" data-tip="添加同级节点">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><circle cx="8" cy="12" r="3" /><circle cx="16" cy="12" r="3" /><path d="M11 12h2" /></svg>
    </button>
    <button class="node-tool-btn" type="button" data-action="add-parent" data-tip="添加父级节点">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M12 19V9 M7 4l5 5 5-5" /></svg>
    </button>
    <button class="node-tool-btn" type="button" data-action="duplicate" data-tip="复制节点">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
    </button>
    <button class="node-tool-btn" type="button" data-action="collapse" data-tip="折叠 / 展开">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    <button class="node-tool-btn danger" type="button" data-action="delete" data-tip="删除节点">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
    </button>
  </div>
</template>
