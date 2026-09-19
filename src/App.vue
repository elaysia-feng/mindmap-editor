<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import CanvasStage from './components/CanvasStage.vue';
import DocumentLibrary from './components/DocumentLibrary.vue';
import EditorOverlays from './components/EditorOverlays.vue';
import MarkdownPanel from './components/MarkdownPanel.vue';
import Sidebar from './components/Sidebar.vue';
import TopBar from './components/TopBar.vue';
import WorkspaceRail from './components/WorkspaceRail.vue';
import {
  LEGACY_STORAGE_KEY,
  createDocument,
  duplicateDocument,
  getDocument,
  listDocuments,
  migrateLegacyDocument,
  moveDocumentToTrash,
  restoreDocument,
  saveDocument,
  type EditorSnapshot,
  type MindMapDocument,
} from './storage/documentRepository';

type SidebarTab = 'overview' | 'outline' | 'shortcuts';
type Command = { id: string; label: string; description: string; shortcut?: string; group: string };

const documents = ref<MindMapDocument[]>([]);
const trash = ref<MindMapDocument[]>([]);
const currentDocumentId = ref<string | null>(null);
const editorReady = ref(false);
const editorInitialized = ref(false);
const libraryOpen = ref(false);
const storageError = ref('');
const activeSidebarTab = ref<SidebarTab>('outline');
const sidebarOpen = ref(false);
const commandOpen = ref(false);
const helpOpen = ref(false);
const commandQuery = ref('');
const selectedCommandIndex = ref(0);
const commandInput = ref<HTMLInputElement | null>(null);
const commandReturnFocus = ref<HTMLElement | null>(null);
const helpReturnFocus = ref<HTMLElement | null>(null);

const SETTINGS_KEY = 'inkmap-library-settings';
let saveQueue = Promise.resolve();

const commands: Command[] = [
  { id: 'new-node', label: '添加一个新节点', description: '从当前选中节点创建子节点', shortcut: 'Tab', group: '编辑' },
  { id: 'layout', label: '整理当前布局', description: '按层级重新排列整张脑图', shortcut: 'F', group: '编辑' },
  { id: 'map', label: '回到脑图', description: '关闭文字稿并回到空间画布', group: '视图' },
  { id: 'split', label: '打开 Markdown 文字稿', description: '在画布旁编辑线性结构', group: '视图' },
  { id: 'outline', label: '打开结构导航', description: '定位节点并查看整张脑图', shortcut: 'Ctrl B', group: '导航' },
  { id: 'library', label: '返回文档库', description: '打开本地观测日志', group: '文件' },
  { id: 'export-md', label: '导出 Markdown', description: '下载当前文字结构', group: '文件' },
  { id: 'export-json', label: '导出 JSON 备份', description: '下载包含位置与连线的备份', group: '文件' },
  { id: 'help', label: '快捷键与帮助', description: '查看编辑、画布和连线操作', group: '帮助' },
  { id: 'theme', label: '切换日间 / 夜间航图', description: '调整当前阅读环境', group: '偏好' },
];

const filteredCommands = computed(() => {
  const query = commandQuery.value.trim().toLocaleLowerCase();
  return query
    ? commands.filter((command) => [command.label, command.description, command.group].join(' ').toLocaleLowerCase().includes(query))
    : commands;
});
const activeCommand = computed(() => filteredCommands.value[selectedCommandIndex.value]);

watch(commandQuery, () => { selectedCommandIndex.value = 0; });

function readSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as { lastDocumentId?: string }; }
  catch { return {}; }
}

function writeSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ lastDocumentId: currentDocumentId.value }));
}

async function refreshDocuments() {
  documents.value = await listDocuments(false);
  trash.value = await listDocuments(true);
}

async function initializeEditor() {
  if (editorInitialized.value) return;
  editorReady.value = true;
  await nextTick();
  const editor = await import('./editor/controller');
  editor.init();
  editorInitialized.value = true;
}

async function openDocument(id: string) {
  if (editorInitialized.value && currentDocumentId.value) {
    window.dispatchEvent(new Event('mindmap:flush-save'));
  }
  await saveQueue;
  const documentRecord = await getDocument(id);
  if (!documentRecord || documentRecord.deletedAt) return;
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(documentRecord.content));
  currentDocumentId.value = id;
  writeSettings();
  if (!editorInitialized.value) {
    await initializeEditor();
  } else {
    window.dispatchEvent(new CustomEvent('mindmap:load-document', { detail: documentRecord.content }));
  }
  libraryOpen.value = false;
  document.body.classList.remove('library-open');
}

async function createNewDocument(template?: string) {
  const record = await createDocument();
  await refreshDocuments();
  await openDocument(record.id);
  if (template) {
    await nextTick();
    window.dispatchEvent(new CustomEvent('mindmap:load-example', { detail: template }));
  }
}

async function duplicate(id: string) {
  await saveQueue;
  await duplicateDocument(id);
  await refreshDocuments();
}

async function moveToTrash(id: string) {
  await saveQueue;
  await moveDocumentToTrash(id);
  if (currentDocumentId.value === id) {
    currentDocumentId.value = null;
    writeSettings();
  }
  await refreshDocuments();
}

async function restore(id: string) {
  await restoreDocument(id);
  await refreshDocuments();
}

async function importBackup(file: File) {
  try {
    const data = JSON.parse(await file.text());
    const snapshot = (data.content || data) as EditorSnapshot;
    if (!snapshot.root) throw new Error('备份中没有有效脑图');
    const record = await createDocument(undefined, snapshot);
    await refreshDocuments();
    await openDocument(record.id);
  } catch (error) {
    storageError.value = error instanceof Error ? error.message : '导入备份失败';
  }
}

async function exportBackup(id: string) {
  const record = await getDocument(id);
  if (!record) return;
  const blob = new Blob([JSON.stringify(record.content, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${record.title || 'inkmap'}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function showLibrary() {
  window.dispatchEvent(new Event('mindmap:flush-save'));
  closeCommand();
  setSidebarOpen(false);
  libraryOpen.value = true;
  document.body.classList.add('library-open');
  saveQueue.then(refreshDocuments).catch(() => { storageError.value = '无法读取本地文档库'; });
}

function closeLibrary() {
  if (!currentDocumentId.value) return;
  libraryOpen.value = false;
  document.body.classList.remove('library-open');
}

function setSidebarOpen(open: boolean) {
  sidebarOpen.value = open;
  document.body.classList.toggle('sidebar-closed', !open);
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}

function selectWorkspaceTab(tab: SidebarTab) {
  const shouldOpen = !sidebarOpen.value || activeSidebarTab.value !== tab;
  activeSidebarTab.value = tab === 'shortcuts' ? 'outline' : tab;
  setSidebarOpen(shouldOpen);
}

function clickExisting(selector: string) {
  document.querySelector<HTMLButtonElement>(selector)?.click();
}

function rememberFocus(target: { value: HTMLElement | null }) {
  const active = document.activeElement;
  target.value = active instanceof HTMLElement && !active.closest('.overlay-layer') ? active : null;
}

function restoreFocus(target: { value: HTMLElement | null }) {
  const element = target.value;
  target.value = null;
  if (element?.isConnected) nextTick(() => element.focus());
}

function openCommand() {
  if (libraryOpen.value || commandOpen.value) return;
  rememberFocus(commandReturnFocus);
  commandOpen.value = true;
  commandQuery.value = '';
  selectedCommandIndex.value = 0;
  nextTick(() => commandInput.value?.focus());
}

function closeCommand() {
  if (!commandOpen.value) return;
  commandOpen.value = false;
  commandQuery.value = '';
  restoreFocus(commandReturnFocus);
}

function openHelp() {
  rememberFocus(helpReturnFocus);
  helpOpen.value = true;
}

function closeHelp() {
  helpOpen.value = false;
  restoreFocus(helpReturnFocus);
}

function runCommand(command: Command | undefined = activeCommand.value) {
  if (!command) return;
  closeCommand();
  const actions: Record<string, () => void> = {
    'new-node': () => clickExisting('#btn-add-root'),
    layout: () => clickExisting('#btn-auto-layout'),
    map: () => clickExisting('.mode-btn[data-mode="map"]'),
    split: () => clickExisting('.mode-btn[data-mode="split"]'),
    outline: () => setSidebarOpen(true),
    library: showLibrary,
    'export-md': () => clickExisting('#btn-export-md'),
    'export-json': () => clickExisting('#btn-export-json'),
    help: openHelp,
    theme: () => clickExisting('#btn-theme'),
  };
  actions[command.id]?.();
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (libraryOpen.value) return;
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === 'k') {
    event.preventDefault();
    openCommand();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === 'b') {
    event.preventDefault();
    setSidebarOpen(!sidebarOpen.value);
    return;
  }
  if (commandOpen.value) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedCommandIndex.value = Math.min(selectedCommandIndex.value + 1, filteredCommands.value.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedCommandIndex.value = Math.max(0, selectedCommandIndex.value - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      runCommand();
    } else if (event.key === 'Escape') closeCommand();
  } else if (helpOpen.value && event.key === 'Escape') {
    closeHelp();
  }
}

function handleEditorSave(event: Event) {
  if (!currentDocumentId.value) return;
  const snapshot = structuredClone((event as CustomEvent<EditorSnapshot>).detail);
  if (!snapshot?.root) return;
  const id = currentDocumentId.value;
  saveQueue = saveQueue.then(async () => {
    try {
      await saveDocument(id, snapshot);
      storageError.value = '';
      await refreshDocuments();
    } catch {
      storageError.value = '本地文档库保存失败，请先导出备份';
      const state = document.querySelector<HTMLElement>('#save-state');
      if (state) {
        state.textContent = '保存失败';
        state.dataset.state = 'error';
      }
    }
  });
}

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown);
  window.addEventListener('mindmap:state-saved', handleEditorSave);
  document.body.classList.add('sidebar-closed');
  try {
    await migrateLegacyDocument();
    await refreshDocuments();
    const lastId = readSettings().lastDocumentId;
    const target = documents.value.find((item) => item.id === lastId) || documents.value[0];
    if (target) {
      await openDocument(target.id);
    } else {
      libraryOpen.value = true;
      document.body.classList.add('library-open');
    }
  } catch {
    storageError.value = '无法打开本地文档库，请检查浏览器存储权限';
    libraryOpen.value = true;
    document.body.classList.add('library-open');
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  window.removeEventListener('mindmap:state-saved', handleEditorSave);
});
</script>

<template>
  <div class="app-root">
    <div v-if="editorReady" class="editor-shell" :aria-hidden="libraryOpen">
      <CanvasStage />
      <TopBar @command="openCommand" @help="openHelp" @library="showLibrary" @toggle-sidebar="setSidebarOpen(!sidebarOpen)" />
      <WorkspaceRail :active-tab="activeSidebarTab" :sidebar-open="sidebarOpen" @select="selectWorkspaceTab" @command="openCommand" @help="openHelp" />
      <MarkdownPanel />
      <Sidebar :open="sidebarOpen" :active-tab="activeSidebarTab" @update:active-tab="activeSidebarTab = $event" @help="openHelp" @close="setSidebarOpen(false)" />
      <EditorOverlays />
    </div>

    <DocumentLibrary
      v-if="libraryOpen"
      :documents="documents"
      :trash="trash"
      :current-id="currentDocumentId"
      :storage-error="storageError"
      @close="closeLibrary"
      @open="openDocument"
      @create="createNewDocument"
      @duplicate="duplicate"
      @trash="moveToTrash"
      @restore="restore"
      @export="exportBackup"
      @import="importBackup"
    />

    <Teleport to="body">
      <div v-if="commandOpen" class="overlay-layer command-layer" role="presentation" @click.self="closeCommand">
        <section class="command-palette" role="dialog" aria-modal="true" aria-label="搜索操作">
          <div class="command-search-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
            <input ref="commandInput" v-model="commandQuery" type="search" placeholder="搜索操作、视图或文件" aria-label="搜索操作、视图或文件" />
            <kbd>Esc</kbd>
          </div>
          <div class="command-list" role="listbox" aria-label="操作列表">
            <button v-for="(command, index) in filteredCommands" :key="command.id" type="button" class="command-item" :class="{ active: index === selectedCommandIndex }" role="option" :aria-selected="index === selectedCommandIndex" @mouseenter="selectedCommandIndex = index" @click="runCommand(command)">
              <span class="command-copy"><strong>{{ command.label }}</strong><small>{{ command.description }}</small></span>
              <span class="command-group">{{ command.group }}</span><kbd v-if="command.shortcut">{{ command.shortcut }}</kbd>
            </button>
            <div v-if="!filteredCommands.length" class="command-empty">没有找到对应操作。</div>
          </div>
        </section>
      </div>

      <div v-if="helpOpen" class="overlay-layer help-layer" role="presentation" @click.self="closeHelp">
        <section class="help-dialog" role="dialog" aria-modal="true" aria-label="快捷键指南">
          <header class="dialog-header"><div><h2>快捷键与画布操作</h2><p>高频编辑保持在键盘附近，高级关系按需出现。</p></div><button class="dialog-close" type="button" aria-label="关闭" @click="closeHelp">×</button></header>
          <div class="help-content">
            <section class="help-section"><h3>构建结构</h3><div class="help-row"><kbd>Tab</kbd><span>添加子节点</span></div><div class="help-row"><kbd>Enter</kbd><span>添加同级节点</span></div><div class="help-row"><kbd>F2</kbd><span>编辑节点</span></div><div class="help-row"><kbd>Del</kbd><span>删除节点</span></div></section>
            <section class="help-section"><h3>移动与聚焦</h3><div class="help-row"><kbd>Space</kbd><span>折叠 / 展开</span></div><div class="help-row"><kbd>F</kbd><span>适配视图</span></div><div class="help-row"><kbd>Ctrl B</kbd><span>结构导航</span></div><div class="help-row"><kbd>Ctrl K</kbd><span>搜索操作</span></div></section>
          </div>
          <footer class="dialog-footer"><span>内容只保存在当前浏览器</span><button type="button" class="button-secondary" @click="closeHelp">知道了</button></footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>
