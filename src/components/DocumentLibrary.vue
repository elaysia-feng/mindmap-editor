<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { MindMapDocument } from '../storage/documentRepository';

const props = defineProps<{
  documents: MindMapDocument[];
  trash: MindMapDocument[];
  currentId: string | null;
  storageError: string;
}>();

const emit = defineEmits<{
  close: [];
  open: [id: string];
  create: [template?: string];
  duplicate: [id: string];
  trash: [id: string];
  restore: [id: string];
  export: [id: string];
  import: [file: File];
}>();

const query = ref('');
const selectedId = ref(props.currentId || props.documents[0]?.id || '');
const showingTrash = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const filteredDocuments = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase();
  const source = showingTrash.value ? props.trash : props.documents;
  if (!keyword) return source;
  return source.filter((document) => document.title.toLocaleLowerCase().includes(keyword));
});

const selectedDocument = computed(() => (
  [...props.documents, ...props.trash].find((document) => document.id === selectedId.value)
  || filteredDocuments.value[0]
));

watch(filteredDocuments, (documents) => {
  if (!documents.some((document) => document.id === selectedId.value)) {
    selectedId.value = documents[0]?.id || '';
  }
});

function formatDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function importFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit('import', file);
  input.value = '';
}
</script>

<template>
  <section class="library-shell" aria-label="本地文档库">
    <header class="library-topbar">
      <a class="library-brand" href="#" @click.prevent="emit('close')">
        <span class="library-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><circle cx="12" cy="12" r="2.5"/><path d="M9.5 10 5 6.5M9.5 14 5 17.5M14.5 10 19 6.5M14.5 14 19 17.5"/></svg>
        </span>
        <strong>INKMAP</strong>
      </a>
      <div class="library-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
        <input v-model="query" type="search" placeholder="搜索本地文档" aria-label="搜索本地文档" />
      </div>
      <div class="library-top-actions">
        <button class="library-quiet-btn" type="button" @click="fileInput?.click()">导入</button>
        <button class="library-primary-btn" type="button" @click="emit('create')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          新建脑图
        </button>
      </div>
      <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="importFile" />
    </header>

    <div class="library-layout">
      <aside class="library-index">
        <div class="library-heading">
          <div>
            <h1>{{ showingTrash ? '回收站' : '观测日志' }}</h1>
            <p>{{ showingTrash ? '恢复仍需要的本地文档' : '继续一条思路，或开启新的结构。' }}</p>
          </div>
          <button class="library-trash-toggle" type="button" @click="showingTrash = !showingTrash">
            {{ showingTrash ? '返回文档' : `回收站 ${trash.length || ''}` }}
          </button>
        </div>

        <div v-if="storageError" class="library-error" role="alert">{{ storageError }}</div>

        <div v-if="filteredDocuments.length" class="document-list">
          <button
            v-for="document in filteredDocuments"
            :key="document.id"
            class="document-row"
            :class="{ selected: selectedDocument?.id === document.id }"
            type="button"
            @click="selectedId = document.id"
            @dblclick="!showingTrash && emit('open', document.id)"
          >
            <span class="document-orbit" aria-hidden="true"></span>
            <span class="document-row-copy">
              <strong>{{ document.title }}</strong>
              <small>{{ formatDate(document.updatedAt) }} · {{ document.nodeCount }} 个节点</small>
            </span>
            <span v-if="document.id === currentId && !showingTrash" class="document-current">正在编辑</span>
          </button>
        </div>

        <div v-else class="library-empty">
          <strong>{{ query ? '没有匹配的文档' : showingTrash ? '回收站是空的' : '还没有本地文档' }}</strong>
          <p v-if="!query && !showingTrash">从一个中心主题开始，结构会留在这台设备上。</p>
          <button v-if="!query && !showingTrash" type="button" @click="emit('create')">创建第一张脑图</button>
        </div>
      </aside>

      <main class="library-preview">
        <template v-if="selectedDocument">
          <div class="preview-meta">
            <span>{{ showingTrash ? '已移入回收站' : '最近编辑' }}</span>
            <span>{{ formatDate(selectedDocument.updatedAt) }}</span>
          </div>
          <div class="preview-constellation" aria-hidden="true">
            <svg viewBox="0 0 720 360" fill="none">
              <path d="M360 180C280 180 280 90 190 90M360 180C280 180 275 270 175 270M360 180C445 180 450 95 540 95M360 180C445 180 455 265 555 265" />
              <path d="M190 90h-72M190 90l-48-48M175 270h-78M175 270l-46 46M540 95h86M540 95l45-45M555 265h80M555 265l42 45" />
              <g><circle cx="360" cy="180" r="8"/><circle cx="190" cy="90" r="5"/><circle cx="175" cy="270" r="5"/><circle cx="540" cy="95" r="5"/><circle cx="555" cy="265" r="5"/></g>
            </svg>
            <div class="preview-title"><span></span><strong>{{ selectedDocument.title }}</strong></div>
          </div>
          <div class="preview-summary">
            <div><strong>{{ selectedDocument.nodeCount }}</strong><span>节点</span></div>
            <div><strong>{{ selectedDocument.content.links?.length || 0 }}</strong><span>关系</span></div>
            <div><strong>本地</strong><span>存储位置</span></div>
          </div>
          <div class="preview-actions">
            <template v-if="showingTrash">
              <button class="library-primary-btn" type="button" @click="emit('restore', selectedDocument.id)">恢复文档</button>
            </template>
            <template v-else>
              <button class="library-primary-btn" type="button" @click="emit('open', selectedDocument.id)">继续编辑</button>
              <button class="library-quiet-btn" type="button" @click="emit('duplicate', selectedDocument.id)">创建副本</button>
              <button class="library-quiet-btn" type="button" @click="emit('export', selectedDocument.id)">导出备份</button>
              <button class="library-danger-btn" type="button" @click="emit('trash', selectedDocument.id)">移到回收站</button>
            </template>
          </div>
        </template>
      </main>
    </div>

    <footer v-if="!showingTrash" class="template-strip">
      <span>从结构开始</span>
      <button type="button" @click="emit('create', 'project')">产品开发</button>
      <button type="button" @click="emit('create', 'learning')">学习路径</button>
      <button type="button" @click="emit('create', 'book')">读书笔记</button>
      <small>文档只保存在当前浏览器</small>
    </footer>
  </section>
</template>
