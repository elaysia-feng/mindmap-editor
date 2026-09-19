<template>
  <footer id="statusbar" aria-label="文档状态">
    <div class="status-left">
      <span class="status-live-dot" aria-hidden="true"></span>
      <span id="status-info">单击选中 · 双击编辑 · 从输出端口拖到输入端口连线</span>
    </div>
    <div class="status-right">
      <span class="status-chip"><span class="status-chip-label">缩放</span><strong id="zoom-info">100%</strong></span>
      <span class="status-chip"><span class="status-chip-label">节点</span><strong id="node-info">0 个</strong></span>
      <span class="status-chip"><span class="status-chip-label">连线</span><strong id="link-info">0 条</strong></span>
    </div>
  </footer>

  <div id="floating-actions">
    <button class="fab" id="fab-fit" type="button" title="适配可读视图 (F)" aria-label="适配可读视图">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9V5a2 2 0 0 1 2-2h4M15 3h4a2 2 0 0 1 2 2v4M21 15v4a2 2 0 0 1-2 2h-4M9 21H5a2 2 0 0 1-2-2v-4" /></svg>
    </button>
    <div class="zoom-controls" aria-label="缩放控制">
      <button class="zoom-btn" id="zoom-out" type="button" title="缩小" aria-label="缩小">−</button>
      <button class="zoom-btn reset" id="zoom-reset" type="button" title="重置视图" aria-label="重置视图">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7" /><path d="M12 5v3M12 16v3M5 12h3M16 12h3" /></svg>
      </button>
      <button class="zoom-btn" id="zoom-in" type="button" title="放大" aria-label="放大">+</button>
    </div>
  </div>

  <input id="md-file-input" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden />
  <input id="json-file-input" type="file" accept=".json,application/json" hidden />

  <div id="context-menu" class="context-menu hidden" role="menu" aria-label="节点操作">
    <button class="ctx-item" type="button" data-action="add-child" role="menuitem">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      <span>添加子节点</span>
      <em>Tab</em>
    </button>
    <button class="ctx-item" type="button" data-action="add-sibling" role="menuitem">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg>
      <span>添加同级节点</span>
      <em>Enter</em>
    </button>
    <button class="ctx-item" type="button" data-action="edit" role="menuitem">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
      <span>编辑节点</span>
      <em>F2</em>
    </button>
    <div class="ctx-divider"></div>
    <button class="ctx-item" type="button" data-action="collapse" role="menuitem">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      <span>折叠 / 展开</span>
      <em>Space</em>
    </button>
    <button class="ctx-item ctx-danger" type="button" data-action="delete" role="menuitem">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
      <span>删除节点</span>
      <em>Del</em>
    </button>
  </div>

  <div id="drag-hint" class="drag-hint hidden">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
    <span>松开鼠标挂到目标节点下</span>
  </div>

  <div id="node-picker" class="node-picker hidden" role="dialog" aria-label="添加节点">
    <span class="picker-label">NEW WORD BLOCK</span>
    <div class="node-picker-title">添加节点</div>
    <div class="node-picker-subtitle">节点会自动接到这根连线上</div>
    <input id="node-picker-input" type="text" maxlength="80" placeholder="输入节点名称" aria-label="节点名称" />
    <div class="node-picker-actions">
      <button id="node-picker-cancel" type="button" class="ghost">取消</button>
      <button id="node-picker-create" type="button">创建节点</button>
    </div>
  </div>

  <div id="toast" class="toast hidden" role="status" aria-live="polite"></div>

  <div id="node-toolbar" class="node-toolbar hidden" aria-label="节点快捷操作">
    <button class="node-tool-btn" type="button" data-action="link" data-tip="从此处拉出连线" aria-label="从此处拉出连线">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
    </button>
    <button class="node-tool-btn" type="button" data-action="edit" data-tip="编辑节点" aria-label="编辑节点">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
    </button>
    <button class="node-tool-btn" type="button" data-action="add-sibling" data-tip="添加同级节点" aria-label="添加同级节点">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="12" r="3" /><circle cx="16" cy="12" r="3" /><path d="M11 12h2" /></svg>
    </button>
    <button class="node-tool-btn" type="button" data-action="add-parent" data-tip="添加父级节点" aria-label="添加父级节点">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><path d="M12 19V9M7 4l5 5 5-5" /></svg>
    </button>
    <button class="node-tool-btn" type="button" data-action="duplicate" data-tip="复制节点" aria-label="复制节点">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
    </button>
    <button class="node-tool-btn" type="button" data-action="collapse" data-tip="折叠 / 展开" aria-label="折叠 / 展开">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    <button class="node-tool-btn danger" type="button" data-action="delete" data-tip="删除节点" aria-label="删除节点">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
    </button>
  </div>
</template>
