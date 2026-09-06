<script setup lang="ts">
import { onMounted } from 'vue';
import CanvasStage from './components/CanvasStage.vue';
import TopBar from './components/TopBar.vue';
import MarkdownPanel from './components/MarkdownPanel.vue';
import Sidebar from './components/Sidebar.vue';
import EditorOverlays from './components/EditorOverlays.vue';

onMounted(async () => {
  // 让 Vue 先完成组件挂载，再启动依赖真实 DOM 的画布编辑核心。
  const editor = await import('./editor/controller');
  editor.init();
});
</script>

<template>
  <CanvasStage />
  <TopBar />
  <MarkdownPanel />
  <Sidebar />
  <EditorOverlays />
</template>
