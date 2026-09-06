<template>
  <section id="markdown-panel" aria-label="Markdown 编辑器">
    <header class="markdown-header">
      <div class="markdown-heading">
        <div class="markdown-badge">MD</div>
        <div>
          <span class="panel-label">TEXT VIEW</span>
          <h2>Markdown</h2>
          <p>用文本编辑结构，画布会实时回应。</p>
        </div>
      </div>
      <div class="markdown-header-actions">
        <span class="markdown-status-wrap">
          <span class="status-dot" aria-hidden="true"></span>
          <span id="markdown-status" class="markdown-status" aria-live="polite">已同步</span>
        </span>
        <button class="panel-action" id="md-open-file" type="button" title="打开 Markdown 文件" aria-label="打开 Markdown 文件">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h6l2 2h8v14H4z" /><path d="M12 17V9M9 12l3-3 3 3" /></svg>
        </button>
        <button class="panel-action" id="md-export-file" type="button" title="导出当前 Markdown" aria-label="导出当前 Markdown">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h6l2 2h8v14H4z" /><path d="M12 9v8M9 14l3 3 3-3" /></svg>
        </button>
      </div>
    </header>
    <div class="markdown-editor-shell">
      <div id="md-gutter" class="md-gutter" aria-hidden="true">1</div>
      <textarea id="markdown-editor" spellcheck="false" aria-label="Markdown 内容" placeholder="# 我的脑图主题
## 第一分支
- 想法 1
- 想法 2
  - 细节 A"></textarea>
    </div>
    <div id="markdown-error" class="markdown-error hidden" role="alert"></div>
    <footer class="markdown-footer">
      <span>支持标题、列表和引用层级</span>
      <span class="markdown-footer-shortcut"><kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd><span>应用结构</span></span>
    </footer>
  </section>
</template>
