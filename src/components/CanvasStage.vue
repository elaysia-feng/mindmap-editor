<template>
  <main id="canvas-stage" aria-label="脑图画布">
    <div class="canvas-context">
      <div class="canvas-context-copy">
        <span class="canvas-label">LIVE MAP</span>
        <strong id="canvas-document-name">未命名脑图</strong>
      </div>
      <span class="canvas-mode-chip">本地工作区</span>
    </div>
    <div class="canvas-help">
      <span class="canvas-help-mark" aria-hidden="true"></span>
      <span>双击空白处创建节点</span>
      <span class="canvas-help-separator" aria-hidden="true"></span>
      <span>拖动右侧端口创建连线</span>
    </div>

    <div id="canvas-viewport">
      <div id="canvas-world">
        <svg id="connections" xmlns="http://www.w3.org/2000/svg"></svg>
        <div id="nodes"></div>
      </div>
    </div>

    <div class="canvas-legend" aria-hidden="true">
      <span><i class="legend-line"></i>层级关系</span>
      <span><i class="legend-line legend-flow"></i>工作流连线</span>
      <span><i class="legend-dot"></i>可继续展开</span>
    </div>
  </main>
</template>
