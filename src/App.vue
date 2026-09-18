<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import CanvasStage from './components/CanvasStage.vue';
import TopBar from './components/TopBar.vue';
import MarkdownPanel from './components/MarkdownPanel.vue';
import Sidebar from './components/Sidebar.vue';
import WorkspaceRail from './components/WorkspaceRail.vue';
import EditorOverlays from './components/EditorOverlays.vue';

type SidebarTab = 'overview' | 'outline' | 'shortcuts';

type Command = {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  group: string;
};

const sidebarOpen = ref(typeof window === 'undefined' || window.innerWidth > 768);
const activeSidebarTab = ref<SidebarTab>('overview');
const commandOpen = ref(false);
const helpOpen = ref(false);
const commandQuery = ref('');
const selectedCommandIndex = ref(0);
const commandInput = ref<HTMLInputElement | null>(null);

const commands: Command[] = [
  { id: 'undo', label: '撤销', description: '恢复上一步修改', shortcut: 'Ctrl Z', group: '编辑' },
  { id: 'redo', label: '重做', description: '重新应用已撤销的修改', shortcut: 'Ctrl Shift Z', group: '编辑' },
  { id: 'open-json', label: '打开 JSON 备份', description: '恢复节点、位置与工作流连线', group: '文件' },
  { id: 'clear', label: '清空脑图', description: '新建空白脑图，可撤销恢复', group: '文件' },
  { id: 'fit', label: '适配视图', description: '将所有可见节点放入画布', shortcut: 'F', group: '视图' },
  { id: 'new-node', label: '添加一个新节点', description: '从当前选中节点创建子节点', shortcut: 'Tab', group: '编辑' },
  { id: 'layout', label: '整理当前布局', description: '按层级重新排列整张脑图', group: '编辑' },
  { id: 'map', label: '切换到脑图', description: '回到空间画布视图', group: '视图' },
  { id: 'split', label: '打开分屏视图', description: '同时查看结构与 Markdown', group: '视图' },
  { id: 'markdown', label: '打开 Markdown', description: '用文本快速编辑整张脑图', group: '视图' },
  { id: 'open-md', label: '打开 Markdown 文件', description: '从本地文件载入结构', group: '文件' },
  { id: 'export-md', label: '导出 Markdown', description: '下载当前文本结构', group: '文件' },
  { id: 'export-json', label: '导出 JSON 备份', description: '下载包含位置与连线的备份', group: '文件' },
  { id: 'outline', label: '查看大纲', description: '在右侧导航中定位节点', group: '导航' },
  { id: 'help', label: '打开快捷键指南', description: '查看编辑、画布和连线操作', group: '帮助' },
  { id: 'theme', label: '切换明暗主题', description: '调整当前工作台的阅读环境', group: '偏好' },
];

const filteredCommands = computed(() => {
  const query = commandQuery.value.trim().toLowerCase();
  if (!query) return commands;
  return commands.filter((command) => (
    [command.label, command.description, command.group].join(' ').toLowerCase().includes(query)
  ));
});

const activeCommand = computed(() => filteredCommands.value[selectedCommandIndex.value]);

let previousFocus: HTMLElement | null = null;
watch(() => commandOpen.value || helpOpen.value, async (open) => {
  if (open) {
    previousFocus = document.activeElement as HTMLElement;
    await nextTick();
    document.querySelector<HTMLElement>('.overlay-layer input, .overlay-layer button')?.focus();
  } else {
    await nextTick();
    if (previousFocus?.isConnected) previousFocus.focus();
  }
});
watch(selectedCommandIndex, async () => {
  await nextTick();
  document.querySelector('.command-item.active')?.scrollIntoView({ block: 'nearest' });
});

watch(commandQuery, () => {
  selectedCommandIndex.value = 0;
});

function setSidebarOpen(open: boolean) {
  sidebarOpen.value = open;
  document.body.classList.toggle('sidebar-closed', !open);
}

function clickExisting(selector: string) {
  document.querySelector<HTMLButtonElement>(selector)?.click();
}

function openCommand() {
  helpOpen.value = false;
  commandOpen.value = true;
  commandQuery.value = '';
  selectedCommandIndex.value = 0;
  nextTick(() => commandInput.value?.focus());
}

function closeCommand() {
  commandOpen.value = false;
  commandQuery.value = '';
}

function revealSidebar(tab: SidebarTab = activeSidebarTab.value) {
  activeSidebarTab.value = tab;
  setSidebarOpen(true);
  document.querySelector('#sidebar')?.removeAttribute('style');
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}

function toggleSidebar() {
  if (sidebarOpen.value) {
    setSidebarOpen(false);
    return;
  }
  revealSidebar();
}

function selectSidebarTab(tab: SidebarTab) {
  revealSidebar(tab);
}

function selectWorkspaceTab(tab: SidebarTab) {
  if (tab === 'overview') {
    activeSidebarTab.value = 'overview';
    setSidebarOpen(false);
    return;
  }
  selectSidebarTab(tab);
}

function handleSidebarShortcut() {
  toggleSidebar();
}

function runCommand(command: Command | undefined = activeCommand.value) {
  if (!command) return;

  closeCommand();
  switch (command.id) {
    case 'undo': clickExisting('#btn-undo'); break;
    case 'redo': clickExisting('#btn-redo'); break;
    case 'open-json': clickExisting('#btn-open-json'); break;
    case 'clear': clickExisting('#btn-clear'); break;
    case 'fit': clickExisting('#fab-fit'); break;
    case 'new-node':
      clickExisting('#btn-add-root');
      break;
    case 'layout':
      clickExisting('#btn-auto-layout');
      break;
    case 'map':
      clickExisting('.mode-btn[data-mode="map"]');
      break;
    case 'split':
      clickExisting('.mode-btn[data-mode="split"]');
      break;
    case 'markdown':
      clickExisting('.mode-btn[data-mode="markdown"]');
      break;
    case 'open-md':
      clickExisting('#md-open-file');
      break;
    case 'export-md':
      clickExisting('#btn-export-md');
      break;
    case 'export-json':
      clickExisting('#btn-export-json');
      break;
    case 'outline':
      revealSidebar('outline');
      break;
    case 'help':
      helpOpen.value = true;
      break;
    case 'theme':
      clickExisting('#btn-theme');
      break;
    default:
      break;
  }
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.isComposing) return;
  if (commandOpen.value || helpOpen.value) {
    event.stopImmediatePropagation();
    if (event.key === 'Tab') {
      const dialog = document.querySelector<HTMLElement>('.overlay-layer [role="dialog"]');
      const controls = Array.from(dialog?.querySelectorAll<HTMLElement>('button, input, [tabindex="0"]') || []);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
      return;
    }
  }
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === 'k') {
    event.preventDefault();
    openCommand();
    return;
  }

  if (commandOpen.value) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedCommandIndex.value = Math.min(
        selectedCommandIndex.value + 1,
        Math.max(0, filteredCommands.value.length - 1),
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedCommandIndex.value = Math.max(0, selectedCommandIndex.value - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      runCommand();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeCommand();
    }
    return;
  }

  if (helpOpen.value && event.key === 'Escape') {
    event.preventDefault();
    helpOpen.value = false;
  }
}

let disposed = false;
let disposeEditor: (() => void) | undefined;
onMounted(async () => {
  // 画布编辑核心依赖真实 DOM，等 Vue 完成挂载后再初始化。
  const editor = await import('./editor/controller');
  if (disposed) return;
  disposeEditor = editor.init();
  document.body.classList.toggle('sidebar-closed', !sidebarOpen.value);
  window.addEventListener('keydown', handleGlobalKeydown, true);
  window.addEventListener('mindmap:toggle-sidebar', handleSidebarShortcut);
});

onBeforeUnmount(() => {
  disposed = true;
  disposeEditor?.();
  window.removeEventListener('keydown', handleGlobalKeydown, true);
  window.removeEventListener('mindmap:toggle-sidebar', handleSidebarShortcut);
});
</script>

<template>
  <WorkspaceRail
    :active-tab="activeSidebarTab"
    :sidebar-open="sidebarOpen"
    @select="selectWorkspaceTab"
    @command="openCommand"
    @help="helpOpen = true"
  />
  <CanvasStage />
  <TopBar
    @command="openCommand"
    @help="helpOpen = true"
    @toggle-sidebar="toggleSidebar"
  />
  <MarkdownPanel />
  <Sidebar
    :open="sidebarOpen"
    :active-tab="activeSidebarTab"
    @update:active-tab="selectSidebarTab"
    @help="helpOpen = true"
    @close="setSidebarOpen(false)"
  />
  <EditorOverlays />

  <Teleport to="body">
    <div
      v-if="commandOpen"
      class="overlay-layer command-layer"
      role="presentation"
      @click.self="closeCommand"
    >
      <section
        class="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="搜索操作"
      >
        <div class="command-search-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            ref="commandInput"
            v-model="commandQuery"
            type="search"
            placeholder="搜索操作、视图或文件…"
            aria-label="搜索操作、视图或文件"
          />
          <kbd>Esc</kbd>
        </div>
        <div class="command-list" role="listbox" aria-label="操作列表">
          <button
            v-for="(command, index) in filteredCommands"
            :key="command.id"
            type="button"
            class="command-item"
            :class="{ active: index === selectedCommandIndex }"
            role="option"
            :aria-selected="index === selectedCommandIndex"
            @mouseenter="selectedCommandIndex = index"
            @click="runCommand(command)"
          >
            <span class="command-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 12h12M12 6v12" />
              </svg>
            </span>
            <span class="command-copy">
              <strong>{{ command.label }}</strong>
              <small>{{ command.description }}</small>
            </span>
            <span class="command-group">{{ command.group }}</span>
            <kbd v-if="command.shortcut">{{ command.shortcut }}</kbd>
          </button>
          <div v-if="filteredCommands.length === 0" class="command-empty">
            没有找到对应操作，试试“布局”或“Markdown”。
          </div>
        </div>
        <div class="command-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
          <span><kbd>Enter</kbd> 执行</span>
          <span class="command-footer-note">所有内容只保存在本地浏览器</span>
        </div>
      </section>
    </div>

    <div
      v-if="helpOpen"
      class="overlay-layer help-layer"
      role="presentation"
      @click.self="helpOpen = false"
    >
      <section class="help-dialog" role="dialog" aria-modal="true" aria-label="快捷键指南">
        <header class="dialog-header">
          <div>
            <span class="dialog-label">WORKBENCH GUIDE</span>
            <h2>让结构先于样式出现</h2>
            <p>把节点当作词块，用空间和文字一起整理复杂想法。</p>
          </div>
          <button class="dialog-close" type="button" aria-label="关闭快捷键指南" @click="helpOpen = false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round">
              <path d="M5 5l14 14M19 5 5 19" />
            </svg>
          </button>
        </header>
        <div class="help-content">
          <section class="help-section">
            <h3>构建结构</h3>
            <div class="help-row"><kbd>Tab</kbd><span>添加子节点</span><small>从当前节点向外生长</small></div>
            <div class="help-row"><kbd>Enter</kbd><span>添加同级节点</span><small>保持同一层级的节奏</small></div>
            <div class="help-row"><kbd>F2</kbd><span>编辑节点</span><small>完成后按 Enter 提交</small></div>
            <div class="help-row"><kbd>Del</kbd><span>删除节点</span><small>可用 Ctrl + Z 恢复</small></div>
          </section>
          <section class="help-section">
            <h3>移动与聚焦</h3>
            <div class="help-row"><kbd>Space</kbd><span>折叠 / 展开</span><small>按住并拖动则平移画布</small></div>
            <div class="help-row"><kbd>F</kbd><span>适配视图</span><small>把当前结构放入可读范围</small></div>
            <div class="help-row"><kbd>滚轮</kbd><span>缩放画布</span><small>以指针位置为中心缩放</small></div>
            <div class="help-row"><kbd>Ctrl B</kbd><span>切换导航栏</span><small>为画布留出更多空间</small></div>
          </section>
          <section class="help-section help-section-wide">
            <h3>工作流连线</h3>
            <div class="help-row"><span class="help-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M4 12h16M16 7l5 5-5 5" /></svg></span><span>从节点右侧输出端口拖到目标输入端口</span><small>连接保持有向且不会形成循环</small></div>
            <div class="help-row"><span class="help-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg></span><span>拖到空白处可直接创建并接入新节点</span><small>完成后输入名称即可</small></div>
          </section>
        </div>
        <footer class="dialog-footer">
          <span>当前主题与文档均保存在本机</span>
          <button type="button" class="button-secondary" @click="helpOpen = false">知道了</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
