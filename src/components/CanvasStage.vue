<template>
  <main id="canvas-stage" aria-label="脑图画布">
    <div class="canvas-context">
      <strong id="canvas-document-name">未命名脑图</strong>
      <span class="canvas-mode-chip">本地星图</span>
    </div>
    <div id="canvas-viewport">
      <div id="canvas-world">
        <svg id="connections" xmlns="http://www.w3.org/2000/svg"></svg>
        <div id="nodes"></div>
      </div>
    </div>
    <div class="canvas-help"><span class="canvas-help-mark" aria-hidden="true"></span><span>双击空白处创建节点</span><span>选中节点后显示编辑工具</span></div>
  </main>
</template>
