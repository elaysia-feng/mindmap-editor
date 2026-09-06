<template>
  <section id="markdown-panel" aria-label="Markdown 编辑器">
    <div class="markdown-header">
      <div>
        <div class="markdown-title">Markdown</div>
        <div class="markdown-subtitle">编辑结构，脑图会实时同步</div>
      </div>
      <div class="markdown-header-actions">
        <span id="markdown-status" class="markdown-status" aria-live="polite">已同步</span>
        <button class="panel-action" id="md-open-file" type="button" title="打开 Markdown 文件" aria-label="打开 Markdown 文件">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h6l2 2h8v14H4z" /><path d="M12 11v6 M9 14l3 3 3-3" /></svg>
        </button>
        <button class="panel-action" id="md-export-file" type="button" title="导出当前 Markdown" aria-label="导出当前 Markdown">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h6l2 2h8v14H4z" /><path d="M12 17V9 M9 12l3-3 3 3" /></svg>
        </button>
      </div>
    </div>
    <div class="markdown-editor-shell">
      <div id="md-gutter" class="md-gutter" aria-hidden="true">1</div>
      <textarea id="markdown-editor" spellcheck="false" aria-label="Markdown 内容" placeholder="# 我的脑图主题
## 第一分支
- 想法 1
- 想法 2
  - 细节 A"></textarea>
    </div>
    <div id="markdown-error" class="markdown-error hidden" role="alert"></div>
    <div class="markdown-footer">
      <span>支持标题和列表层级</span>
      <kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd><span>立即应用</span>
    </div>
  </section>
</template>
