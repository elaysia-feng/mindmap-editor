<script setup lang="ts">
type SidebarTab = 'overview' | 'outline' | 'shortcuts';

defineProps<{
  open: boolean;
  activeTab: SidebarTab;
}>();

const emit = defineEmits<{
  'update:activeTab': [tab: SidebarTab];
  help: [];
  close: [];
}>();

function selectTab(tab: SidebarTab) {
  emit('update:activeTab', tab);
}
</script>

<template>
  <aside id="sidebar" :class="{ 'is-hidden': !open }" aria-label="结构导航">
    <header class="sidebar-header">
      <div>
        <span class="sidebar-label">MAP INDEX</span>
        <h2>导航</h2>
      </div>
      <button class="sidebar-close" type="button" aria-label="关闭导航栏" title="关闭导航栏" @click="emit('close')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </header>

    <div class="sidebar-tabs" role="tablist" aria-label="导航内容">
      <button class="sidebar-tab" :class="{ active: activeTab === 'overview' }" type="button" role="tab" :aria-selected="activeTab === 'overview'" @click="selectTab('overview')">
        <span class="tab-marker" aria-hidden="true"></span>
        总览
      </button>
      <button class="sidebar-tab" :class="{ active: activeTab === 'outline' }" type="button" role="tab" :aria-selected="activeTab === 'outline'" @click="selectTab('outline')">
        <span class="tab-marker" aria-hidden="true"></span>
        大纲
      </button>
      <button class="sidebar-tab" :class="{ active: activeTab === 'shortcuts' }" type="button" role="tab" :aria-selected="activeTab === 'shortcuts'" @click="selectTab('shortcuts')">
        <span class="tab-marker" aria-hidden="true"></span>
        快捷键
      </button>
    </div>

    <div class="sidebar-body">
      <section v-show="activeTab === 'overview'" class="sidebar-view overview-view" role="tabpanel">
        <div class="panel-heading">
          <div>
            <span class="panel-label">空间缩略</span>
            <h3>整张脑图</h3>
          </div>
          <span class="panel-hint">拖动节点保持结构</span>
        </div>
        <div id="minimap" aria-label="脑图缩略图"></div>

        <div class="stat-grid" aria-label="文档统计">
          <div class="stat-item">
            <span>节点</span>
            <strong id="node-count-value">0</strong>
          </div>
          <div class="stat-item">
            <span>连线</span>
            <strong id="link-count-value">0</strong>
          </div>
          <div class="stat-item">
            <span>缩放</span>
            <strong id="zoom-value">100%</strong>
          </div>
        </div>

        <div class="focus-block">
          <span class="panel-label">当前焦点</span>
          <strong id="selected-node-label">未选择节点</strong>
          <span id="selected-node-meta">单击节点查看上下文</span>
        </div>

        <div class="side-note">
          <span class="note-mark" aria-hidden="true"></span>
          <span>结构变化会自动同步到 Markdown，内容保存在本地浏览器。</span>
        </div>
      </section>

      <section v-show="activeTab === 'outline'" class="sidebar-view outline-view" role="tabpanel">
        <div class="panel-heading">
          <div>
            <span class="panel-label">层级导航</span>
            <h3>文档大纲</h3>
          </div>
          <span class="panel-hint">点击定位</span>
        </div>
        <div id="outline" aria-label="脑图大纲"></div>
      </section>

      <section v-show="activeTab === 'shortcuts'" class="sidebar-view shortcuts-view" role="tabpanel">
        <div class="panel-heading">
          <div>
            <span class="panel-label">键盘地图</span>
            <h3>快捷操作</h3>
          </div>
          <span class="panel-hint">随时可用</span>
        </div>
        <div class="shortcut-list">
          <div class="shortcut-row"><kbd>Tab</kbd><span>添加子节点</span></div>
          <div class="shortcut-row"><kbd>Enter</kbd><span>添加同级节点</span></div>
          <div class="shortcut-row"><kbd>F2</kbd><span>编辑当前节点</span></div>
          <div class="shortcut-row"><kbd>Del</kbd><span>删除当前节点</span></div>
          <div class="shortcut-row"><kbd>Space</kbd><span>折叠 / 展开节点</span></div>
          <div class="shortcut-row"><kbd>F</kbd><span>适配可读视图</span></div>
          <div class="shortcut-row"><kbd>Ctrl B</kbd><span>切换导航栏</span></div>
          <div class="shortcut-row"><kbd>Ctrl K</kbd><span>搜索全部操作</span></div>
        </div>
        <button class="guide-link" type="button" @click="emit('help')">
          连线与 Markdown 说明
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
        </button>
      </section>
    </div>
  </aside>
</template>
