// 当前编辑器核心大量依赖 DOM 和 Pointer Events，先保留成熟的交互实现；
// Vue 组件只负责宿主结构，后续可在不改变交互契约的前提下逐步补充类型。
// @ts-nocheck

/* ===========================
   脑图编辑器 · MindMap Studio
   主程序
   =========================== */

'use strict';

/* ============== 工具函数 ============== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => root.querySelectorAll(sel);
const uid = () => 'n' + Math.random().toString(36).slice(2, 10);
// 可以安全地拼进 CSS 属性选择器的 id 形状。
const SAFE_ID = /^[A-Za-z0-9_-]+$/;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const isEditableTarget = (target) => Boolean(
  target?.closest?.('input, textarea, select, [contenteditable="true"]')
);

function setSourceLine(node, line) {
  Object.defineProperty(node, '__sourceLine', {
    value: line,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  return node;
}

function setMarkdownSyntax(node, kind, level = 0, indent = 0, marker = '-') {
  if (!kind) return node;
  Object.defineProperty(node, '__markdownKind', {
    value: kind,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  Object.defineProperty(node, '__markdownLevel', {
    value: level,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  Object.defineProperty(node, '__markdownIndent', {
    value: indent,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  Object.defineProperty(node, '__markdownMarker', {
    value: marker,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_PATH = (d, cls = 'connection') => {
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', d);
  p.setAttribute('class', cls);
  return p;
};

/* ============== 数据模型 ============== */
class MindMap {
  constructor(root, links = []) {
    this.root = root || this.createDefault();
    this.links = Array.isArray(links) ? links : [];
    this.nodes = new Map();
    this.parents = new Map();
    this.collapsedCache = new Set();
    this.rebuildIndex();
  }

  createDefault() {
    return {
      id: uid(),
      text: '中心主题',
      x: 0,
      y: 0,
      children: [],
      collapsed: false,
    };
  }

  rebuildIndex() {
    this.nodes.clear();
    this.parents.clear();
    // 导入的 JSON 可能带有重复 id，或含有引号/括号——后者会让 `[data-id="…"]`
    // 选择器抛 SyntaxError。统一换成安全 id，并把连线一起改写过去。
    const remapped = new Map();
    const walk = (n, parent = null) => {
      const originalId = n.id;
      if (typeof n.id !== 'string' || !SAFE_ID.test(n.id) || this.nodes.has(n.id)) {
        const safe = uid();
        if (originalId !== undefined && originalId !== null && !remapped.has(originalId)) {
          remapped.set(originalId, safe);
        }
        n.id = safe;
      }
      this.nodes.set(n.id, n);
      if (parent) this.parents.set(n.id, parent);
      n.children.forEach((child) => walk(child, n));
    };
    walk(this.root);
    const normalizedLinks = [];
    const seenLinks = new Set();
    (Array.isArray(this.links) ? this.links : []).forEach((link) => {
      const from = remapped.get(link?.from) || link?.from;
      const to = remapped.get(link?.to) || link?.to;
      if (!from || !to || from === to || !this.nodes.has(from) || !this.nodes.has(to)) return;
      const key = `${from}->${to}`;
      if (seenLinks.has(key)) return;
      seenLinks.add(key);
      normalizedLinks.push({
        id: link.id || uid(),
        from,
        to,
        sourcePort: link.sourcePort || link.source_port || 'output',
        targetPort: link.targetPort || link.target_port || 'input',
      });
    });
    this.links = normalizedLinks;
    this.refreshCollapsedCache();
  }

  refreshCollapsedCache() {
    this.collapsedCache.clear();
    const walk = (n) => {
      if (n.collapsed) this.collapsedCache.add(n.id);
      n.children.forEach(walk);
    };
    walk(this.root);
  }

  addChild(parentId, text = '新节点', pos = null) {
    const parent = this.nodes.get(parentId);
    if (!parent) return null;
    const isRoot = parent === this.root;
    const idx = parent.children.length;
    const angle = pos?.angle ?? (isRoot
      ? (idx * (Math.PI * 2 / Math.max(parent.children.length + 1, 4))) - Math.PI / 2
      : Math.random() * Math.PI * 2);
    const radius = pos?.radius ?? (isRoot ? 260 : 180);
    const node = {
      id: uid(),
      text,
      x: pos?.x ?? (parent.x + Math.cos(angle) * radius),
      y: pos?.y ?? (parent.y + Math.sin(angle) * radius),
      children: [],
      collapsed: false,
    };
    const inheritedKind = parent.__markdownKind === 'list' ? 'list' : 'heading';
    const inheritedMarker = inheritedKind === 'list' ? parent.__markdownMarker : '-';
    setMarkdownSyntax(node, inheritedKind, 0, 0, inheritedMarker);
    parent.children.push(node);
    this.nodes.set(node.id, node);
    return node;
  }

  remove(id) {
    if (id === this.root.id) return false;
    const node = this.nodes.get(id);
    if (!node) return false;
    let parent = null;
    for (const n of this.nodes.values()) {
      const idx = n.children.indexOf(node);
      if (idx >= 0) {
        n.children.splice(idx, 1);
        parent = n;
        break;
      }
    }
    if (!parent) return false;
    const toRemove = [];
    const walk = (n) => {
      toRemove.push(n.id);
      n.children.forEach(walk);
    };
    walk(node);
    toRemove.forEach((rid) => this.nodes.delete(rid));
    const removedIds = new Set(toRemove);
    this.links = this.links.filter((link) => (
      !removedIds.has(link.from) && !removedIds.has(link.to)
    ));
    this.refreshCollapsedCache();
    return true;
  }

  hasPath(fromId, toId, visited = new Set()) {
    if (fromId === toId) return true;
    if (visited.has(fromId)) return false;
    visited.add(fromId);
    const node = this.nodes.get(fromId);
    if (!node) return false;

    for (const child of node.children) {
      if (this.hasPath(child.id, toId, visited)) return true;
    }
    for (const link of this.links) {
      if (link.from === fromId && this.hasPath(link.to, toId, visited)) return true;
    }
    return false;
  }

  addLink(fromId, toId, sourcePort = 'output', targetPort = 'input') {
    if (fromId === toId || !this.nodes.has(fromId) || !this.nodes.has(toId)) return null;
    const from = this.nodes.get(fromId);
    const to = this.nodes.get(toId);
    if (this.findParent(to) === from) return null;
    if (this.links.some((link) => link.from === fromId && link.to === toId)) return null;
    // 工作流连线保持 DAG，避免把脑图拖成无法解释的循环流程。
    if (this.hasPath(toId, fromId)) return null;

    const link = { id: uid(), from: fromId, to: toId, sourcePort, targetPort };
    this.links.push(link);
    return link;
  }

  removeLink(linkId) {
    const index = this.links.findIndex((link) => link.id === linkId);
    if (index < 0) return null;
    return this.links.splice(index, 1)[0];
  }

  // 保留旧调用名，兼容已经保存的旧版数据和外部脚本。
  toggleLink(fromId, toId) {
    const index = this.links.findIndex((link) => link.from === fromId && link.to === toId);
    if (index >= 0) {
      this.links.splice(index, 1);
      return false;
    }
    return this.addLink(fromId, toId) ? true : null;
  }

  findParent(node) {
    if (node === this.root) return null;
    // 缓存命中前先校验：树结构可能在 rebuildIndex 之前被直接改过。
    const cached = this.parents.get(node.id);
    if (cached && cached.children.includes(node)) return cached;
    for (const n of this.nodes.values()) {
      if (n.children.includes(node)) {
        this.parents.set(node.id, n);
        return n;
      }
    }
    this.parents.delete(node.id);
    return null;
  }

  getDepth(id) {
    let depth = 0;
    let cur = this.nodes.get(id);
    while (cur && cur !== this.root) {
      cur = this.findParent(cur);
      if (!cur) break;
      depth++;
    }
    return depth;
  }

  isCollapsedAncestor(node) {
    if (node === this.root) return false;
    let cur = node;
    while (cur && cur !== this.root) {
      const p = this.findParent(cur);
      if (!p) return false;
      if (p.collapsed) return true;
      cur = p;
    }
    return false;
  }

  countDescendants(node) {
    let c = 0;
    const walk = (n) => {
      c += n.children.length;
      n.children.forEach(walk);
    };
    walk(node);
    return c;
  }

  count() {
    return this.nodes.size;
  }

  toJSON() {
    return JSON.stringify({ root: this.root, links: this.links }, null, 2);
  }

  static fromJSON(json, links) {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      const root = data?.root && Array.isArray(data.root.children) ? data.root : data;
      const linkData = Array.isArray(links) ? links : data?.links;
      return new MindMap(root, linkData);
    } catch (e) {
      return null;
    }
  }

  toMarkdownData() {
    const lines = [];
    const nodeLines = new Map();
    const walk = (node, level, nearestHeadingDepth = 0) => {
      const text = node.text || '';
      nodeLines.set(node.id, lines.length);
      const kind = node.__markdownKind;
      const listMarker = kind === 'list' && /^([-*+]|\d+\.)$/.test(node.__markdownMarker || '')
        ? node.__markdownMarker
        : '-';
      const listIndent = '  '.repeat(Math.max(0, level - nearestHeadingDepth - 1));
      let outputHeading = false;
      if (level === 0) {
        lines.push(`# ${text}`);
        outputHeading = true;
      } else if (kind === 'list') {
        lines.push(`${listIndent}${listMarker} ${text}`);
      } else if (kind === 'blockquote' && level === nearestHeadingDepth + 1) {
        lines.push(`> ${text}`);
      } else if (kind === 'heading' && level <= 5) {
        lines.push(`${'#'.repeat(level + 1)} ${text}`);
        outputHeading = true;
      } else if (!kind && level <= 4) {
        // 没有来源语法的画布新节点沿用旧版的浅层标题输出规则。
        lines.push(`${'#'.repeat(level + 1)} ${text}`);
        outputHeading = true;
      } else {
        // 深层标题无法继续增加层级，退化为当前标题下的列表节点。
        lines.push(`${listIndent}- ${text}`);
      }
      const nextHeadingDepth = outputHeading ? level : nearestHeadingDepth;
      node.children.forEach((c) => walk(c, level + 1, nextHeadingDepth));
    };
    walk(this.root, 0);
    return { text: lines.join('\n'), nodeLines };
  }

  toMarkdown() {
    return this.toMarkdownData().text;
  }
}

/* ============== 默认示例 ============== */
const DEFAULT_SAMPLE = {
  id: 'sample-root',
  text: '我的脑图',
  x: 0,
  y: 0,
  children: [
    {
      id: 's1', text: '快速开始', x: 0, y: 0, children: [
        { id: 's1a', text: '导入 Markdown', x: 0, y: 0, children: [], collapsed: false },
        { id: 's1b', text: '双击节点编辑', x: 0, y: 0, children: [], collapsed: false },
        { id: 's1c', text: '拖拽自由布局', x: 0, y: 0, children: [], collapsed: false },
        { id: 's1d', text: '滚轮缩放 / 拖拽平移', x: 0, y: 0, children: [], collapsed: false },
      ], collapsed: false
    },
    {
      id: 's2', text: '快捷键', x: 0, y: 0, children: [
        { id: 's2a', text: 'Tab - 新建子节点', x: 0, y: 0, children: [], collapsed: false },
        { id: 's2b', text: 'Enter - 新建同级', x: 0, y: 0, children: [], collapsed: false },
        { id: 's2c', text: 'F2 - 编辑节点', x: 0, y: 0, children: [], collapsed: false },
        { id: 's2d', text: 'Delete - 删除节点', x: 0, y: 0, children: [], collapsed: false },
        { id: 's2e', text: 'Space - 折叠展开', x: 0, y: 0, children: [], collapsed: false },
      ], collapsed: false
    },
    {
      id: 's3', text: '进阶玩法', x: 0, y: 0, children: [
        { id: 's3a', text: 'Shift + 拖拽 - 跨节点关联', x: 0, y: 0, children: [], collapsed: false },
        { id: 's3b', text: 'F - 调整到可读视图', x: 0, y: 0, children: [], collapsed: false },
        { id: 's3c', text: '导出 Markdown / JSON', x: 0, y: 0, children: [], collapsed: false },
      ], collapsed: false
    },
    {
      id: 's4', text: '使用场景', x: 0, y: 0, children: [
        { id: 's4a', text: '读书笔记', x: 0, y: 0, children: [], collapsed: false },
        { id: 's4b', text: '项目规划', x: 0, y: 0, children: [], collapsed: false },
        { id: 's4c', text: '知识梳理', x: 0, y: 0, children: [], collapsed: false },
        { id: 's4d', text: '头脑风暴', x: 0, y: 0, children: [], collapsed: false },
      ], collapsed: false
    },
  ],
  collapsed: false
};

/* ============== Markdown 解析 ============== */
function isMarkdownSeparator(line) {
  return /^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line);
}

function isSupportedMarkdownLine(line) {
  if (!line.trim()) return true;
  if (isMarkdownSeparator(line)) return true;
  if (/^(#{1,6})\s+(.+)$/.test(line)) return true;
  if (/^(\s*)([-*+]|\d+\.)\s+(.+)$/.test(line)) return true;
  if (/^(?:>\s*)+(.+)$/.test(line)) return true;
  return false;
}

function migrateLegacyListGroups(text) {
  const source = typeof text === 'string' ? text : '';
  const lines = source.split(/\r?\n/);
  const isFlatList = (line) => /^(\s*)([-*+]|\d+\.)\s+(.+)$/.exec(line);
  const isGroupLead = (content) => /(?:问题|特点|原因|方式|方法|步骤|场景|地方|标准|关键词|判断|说明|要求|结果|情况|内容).*[:：]\s*$/.test(content);
  const isConclusion = (content) => /^(所以|因此|总之|结论|总结|否则)/.test(content.trim());
  const migrated = [...lines];

  lines.forEach((line, parentIndex) => {
    const parent = isFlatList(line);
    if (!parent || parent[1] || !isGroupLead(parent[3])) return;

    let index = parentIndex + 1;
    let grouped = false;
    while (index < lines.length) {
      if (!lines[index].trim()) {
        index++;
        continue;
      }
      const child = isFlatList(lines[index]);
      if (!child || child[1] || isGroupLead(child[3]) || isConclusion(child[3])) break;
      migrated[index] = `  ${migrated[index]}`;
      grouped = true;
      index++;
    }
    if (!grouped) return;
  });

  return migrated.join(source.includes('\r\n') ? '\r\n' : '\n');
}

/**
 * 将编辑器不支持的普通文本转换为可解析的 Markdown 节点。
 * 保留每一行，避免粘贴说明文档时出现整段内容丢失。
 */
export function normalizeMarkdown(text, selection = null) {
  const source = typeof text === 'string' ? text : '';
  const lines = source.split(/\r?\n/);
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const prefixLengths = Array(lines.length).fill(0);
  const convertedFlags = Array(lines.length).fill(false);
  let hasMeaningfulLine = false;
  const normalizedLines = lines.map((raw, index) => {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim() || isSupportedMarkdownLine(line)) {
      if (line.trim() && !isMarkdownSeparator(line)) hasMeaningfulLine = true;
      return raw;
    }

    const prefix = hasMeaningfulLine ? '- ' : '# ';
    prefixLengths[index] = prefix.length;
    convertedFlags[index] = true;
    hasMeaningfulLine = true;
    return `${prefix}${line.trim()}`;
  });

  // 普通说明行后面的列表属于这段说明，自动补两格缩进，形成“说明节点 → 原因列表”。
  // 只处理刚刚转换出的普通行，已经合法的 Markdown 列表保持原样，保证规范输入幂等。
  const getListMatch = (line) => line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
  const isFlatListLine = (line) => {
    const match = getListMatch(line);
    return Boolean(match && !match[1]);
  };
  const findNextContent = (start) => {
    for (let index = start; index < lines.length; index++) {
      if (lines[index].trim()) return index;
    }
    return -1;
  };
  const groupedListLines = new Set();
  convertedFlags.forEach((converted, parentIndex) => {
    if (!converted || !normalizedLines[parentIndex].startsWith('- ')) return;
    let index = findNextContent(parentIndex + 1);
    if (index < 0 || !isFlatListLine(lines[index])) return;
    while (index >= 0 && index < lines.length && isFlatListLine(lines[index])) {
      groupedListLines.add(index);
      index = findNextContent(index + 1);
    }
  });
  groupedListLines.forEach((index) => {
    normalizedLines[index] = `  ${normalizedLines[index]}`;
    prefixLengths[index] += 2;
  });

  const convertedLines = convertedFlags.reduce((result, converted, index) => {
    if (converted) result.push(index + 1);
    return result;
  }, []);
  const convertedCount = convertedLines.length;
  const normalizedText = normalizedLines.join(newline);

  const mapOffset = (offset) => {
    const safeOffset = clamp(Number(offset) || 0, 0, source.length);
    const lineIndex = source.slice(0, safeOffset).split('\n').length - 1;
    const previousPrefixes = prefixLengths
      .slice(0, lineIndex)
      .reduce((total, length) => total + length, 0);
    return clamp(safeOffset + previousPrefixes + (prefixLengths[lineIndex] || 0), 0,
      normalizedText.length);
  };

  return {
    text: normalizedText,
    convertedCount,
    convertedLines,
    selection: selection
      ? { start: mapOffset(selection.start), end: mapOffset(selection.end) }
      : null,
  };
}

function parseMarkdown(text) {
  const root = {
    id: uid(),
    text: '中心主题',
    x: 0,
    y: 0,
    children: [],
    collapsed: false,
  };

  const diagnostics = [];
  if (!text || !text.trim()) {
    return { root, diagnostics, valid: true };
  }

  const lines = text.split(/\r?\n/);
  const stack = [{ node: root, level: 0 }];
  let firstHeadingDone = false;
  let hasAnyContent = false;
  let currentHeadingLevel = 1;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const raw = lines[lineIndex];
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) continue;

    // Markdown 分隔线只用于排版，不生成脑图节点，也不影响后续层级。
    if (isMarkdownSeparator(line)) continue;

    let level = 1;
    let content = '';
    let matched = false;
    let markdownKind = null;
    let markdownIndent = 0;
    let markdownMarker = '-';

    // 标题: # ## ### ...
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      level = heading[1].length;
      content = heading[2].trim();
      matched = true;
      markdownKind = 'heading';
      markdownMarker = heading[1];
      currentHeadingLevel = level;
      if (!firstHeadingDone) {
        root.text = content;
        setSourceLine(root, lineIndex);
        setMarkdownSyntax(root, markdownKind, level, 0, markdownMarker);
        firstHeadingDone = true;
        hasAnyContent = true;
        continue; // 第一个标题作为根节点文本
      }
    } else {
      // 列表: - * + 或 1.
      const list = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
      if (list) {
        const indent = list[1].length;
        // 列表默认属于最近标题的下一层，之后每两个空格再深入一层。
        level = currentHeadingLevel + 1 + Math.floor(indent / 2);
        content = list[3].trim();
        matched = true;
        markdownKind = 'list';
        markdownIndent = indent;
        markdownMarker = list[2];
        if (indent % 2 !== 0) {
          diagnostics.push({
            line: lineIndex + 1,
            message: '列表缩进建议使用 2 个空格的倍数',
            severity: 'warning',
          });
        }
      } else {
        // 引用块作为最近标题下的说明节点，保留引用内容。
        const blockquote = line.match(/^(?:>\s*)+(.+)$/);
        if (blockquote) {
          level = currentHeadingLevel + 1;
          content = blockquote[1].trim();
          matched = true;
          markdownKind = 'blockquote';
          markdownMarker = '>';
        }
      }
    }

    if (!matched) {
      diagnostics.push({
        line: lineIndex + 1,
        message: '无法识别这一行，请使用标题或列表语法',
        severity: 'error',
      });
      continue;
    }
    hasAnyContent = true;

    // 出栈直到找到 level 更小的祖先
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    const newNode = setMarkdownSyntax(setSourceLine({
      id: uid(),
      text: content,
      x: 0,
      y: 0,
      children: [],
      collapsed: false,
    }, lineIndex), markdownKind, level, markdownIndent, markdownMarker);

    if (stack.length === 0) {
      root.children.push(newNode);
      stack.push({ node: newNode, level });
    } else {
      stack[stack.length - 1].node.children.push(newNode);
      stack.push({ node: newNode, level });
    }
  }

  // 如果没有任何标题被识别，则把整个 root 作为占位
  if (!hasAnyContent && !firstHeadingDone) {
    root.text = text.split('\n')[0].trim().slice(0, 50) || '中心主题';
  }

  return { root, diagnostics, valid: !diagnostics.some((d) => d.severity === 'error') };
}

/* ============== 示例 Markdown ============== */
const EXAMPLES = {
  learning: `# 高效学习方法

## 输入阶段
- 主动阅读
  - 提出问题
  - 做笔记
- 多模态学习
  - 视频
  - 图文
  - 实操

## 处理阶段
- 深度理解
  - 费曼技巧
  - 类比推理
- 建立连接
  - 思维导图
  - 知识卡片

## 输出阶段
- 教授他人
- 写作总结
- 项目实践`,
  project: `# 产品开发流程

## 需求阶段
- 用户调研
- 需求文档
- 可行性分析

## 设计阶段
- 原型设计
- UI 设计
- 技术选型

## 开发阶段
- 前端开发
- 后端开发
- 测试用例

## 上线阶段
- 灰度发布
- 监控告警
- 用户反馈`,
  book: `# 《深度工作》读书笔记

## 核心理念
- 深度工作难以复制
- 刻意练习
- 心流体验
- 摆脱分心

## 实践方法
- 时间块规划
  - 早晨深度工作
  - 下午协作会议
- 数字极简主义
  - 关闭通知
  - 限制社交媒体
- 仪式感建立
  - 固定工作环境
  - 制定工作规则

## 常见障碍
- 随时查看手机
- 无意义的会议
- 邮件成瘾
- 缺乏规划`,
};

/* ============== 自动布局（XMind 风格：根节点两侧分流） ============== */
function autoLayout(root) {
  // 第一遍：自底向上计算每个子树需要的垂直空间
  const H_GAP = 24;       // 同级子节点之间的垂直间距
  const COLUMN_GAP = 42;  // 相邻层级卡片之间的净空
  const MIN_NODE_H = 40;   // 短文本节点的最小高度
  const NODE_WIDTHS = [360, 260, 240, 220, 200, 185, 170];
  const columnX = [0];

  const widthForDepth = (depth) => NODE_WIDTHS[Math.min(depth, NODE_WIDTHS.length - 1)];
  const xForDepth = (depth) => {
    while (columnX.length <= depth) {
      const currentDepth = columnX.length;
      columnX.push(
        columnX[currentDepth - 1]
        + widthForDepth(currentDepth - 1) / 2
        + COLUMN_GAP
        + widthForDepth(currentDepth) / 2,
      );
    }
    return columnX[depth];
  };

  function estimateNodeHeight(node, depth) {
    const isRoot = depth === 0;
    const fontSize = isRoot ? 17 : Math.max(11, 14 - depth * 0.5);
    const contentWidth = isRoot
      ? 304
      : Math.max(132, 224 - (depth - 1) * 16);
    const lineHeight = fontSize * 1.5;
    const verticalPadding = isRoot
      ? 30
      : Math.max(12, 22 - depth * 2);
    const text = String(node.text || '空');
    let lineCount = 0;

    text.split(/\r?\n/).forEach((rawLine) => {
      let width = 0;
      let wrappedLines = 1;
      for (const char of rawLine || ' ') {
        const charWidth = /[^\x00-\xff]/.test(char)
          ? fontSize
          : (/\s/.test(char) ? fontSize * 0.32 : fontSize * 0.56);
        if (width > 0 && width + charWidth > contentWidth) {
          wrappedLines++;
          width = 0;
        }
        width += charWidth;
      }
      lineCount += wrappedLines;
    });

    return Math.max(
      isRoot ? 54 : MIN_NODE_H,
      Math.ceil(lineCount * lineHeight + verticalPadding),
    );
  }

  function gapForDepth(depth) {
    return Math.max(12, H_GAP - depth * 1.5);
  }

  function calcHeight(node, depth = 0) {
    const ownHeight = estimateNodeHeight(node, depth);
    if (node.children.length === 0 || node.collapsed) {
      node._h = ownHeight;
      return node._h;
    }
    let total = 0;
    node.children.forEach((c) => { total += calcHeight(c, depth + 1); });
    node._h = Math.max(
      ownHeight,
      total + gapForDepth(depth) * (node.children.length - 1),
    );
    return node._h;
  }

  // 第二遍：一级主题分到根节点两侧，子树沿所在侧向外展开。
  function place(node, yCenter, depth = 0, side = 'right') {
    node.x = depth === 0 || side === 'right' ? xForDepth(depth) : -xForDepth(depth);
    node.y = yCenter;
    if (node.children.length === 0 || node.collapsed) return;

    const childGap = gapForDepth(depth);
    const totalH = node.children.reduce((s, c) => s + c._h, 0)
                 + childGap * (node.children.length - 1);
    let curTop = yCenter - totalH / 2;

    node.children.forEach((c) => {
      const childCenter = curTop + c._h / 2;
      place(c, childCenter, depth + 1, side);
      curTop += c._h + childGap;
    });
  }

  calcHeight(root);
  root.x = xForDepth(0);
  root.y = 0;
  if (!root.collapsed && root.children.length > 0) {
    const leftCount = Math.floor(root.children.length / 2);
    const placeGroup = (children, side) => {
      if (children.length === 0) return;
      const groupGap = gapForDepth(0);
      const totalH = children.reduce((sum, child) => sum + child._h, 0)
        + groupGap * (children.length - 1);
      let curTop = -totalH / 2;
      children.forEach((child) => {
        const childCenter = curTop + child._h / 2;
        place(child, childCenter, 1, side);
        curTop += child._h + groupGap;
      });
    };
    placeGroup(root.children.slice(0, leftCount), 'left');
    placeGroup(root.children.slice(leftCount), 'right');
  }

  // 居中：让整张图的内容落在画布中央，根节点位于两侧分支之间。
  const b = computeBounds(root);
  const dx = -b.centerX;
  const dy = -b.centerY;
  const shift = (n) => {
    n.x += dx;
    n.y += dy;
    n.children.forEach(shift);
  };
  shift(root);

  // 高度只服务于本次布局，不写进保存数据。
  const cleanup = (n) => {
    delete n._h;
    n.children.forEach(cleanup);
  };
  cleanup(root);
}

function findParentOf(root, node) {
  if (root === node) return null;
  for (const c of root.children) {
    if (c === node) return root;
    const f = findParentOf(c, node);
    if (f) return f;
  }
  return null;
}

function computeBounds(root) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    const x = Number.isFinite(Number(n.x)) ? Number(n.x) : 0;
    const y = Number.isFinite(Number(n.y)) ? Number(n.y) : 0;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    // 折叠节点本身仍可见，但它的子树不参与画布、缩略图和适应视图的边界。
    if (n.collapsed) return;
    (Array.isArray(n.children) ? n.children : []).forEach(walk);
  };
  walk(root);
  if (minX === Infinity) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0, width: 0, height: 0 };
  }
  return {
    minX, maxX, minY, maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/* ============== 视口（平移/缩放） ============== */
function getCanvasRect() {
  const canvas = $('#canvas-viewport');
  if (!canvas) return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  const rect = canvas.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width || window.innerWidth,
    height: rect.height || window.innerHeight,
  };
}

const viewport = {
  x: 0,
  y: 0,
  scale: 1,
  minScale: 0.15,
  maxScale: 3,
  minFitScale: 0.42,

  apply() {
    const w = $('#canvas-world');
    w.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.scale})`;
  },

  zoomAt(factor, cx, cy) {
    const newScale = clamp(this.scale * factor, this.minScale, this.maxScale);
    if (newScale === this.scale) return;
    const rect = getCanvasRect();
    const localCx = cx - rect.left;
    const localCy = cy - rect.top;
    const wx = (localCx - this.x) / this.scale;
    const wy = (localCy - this.y) / this.scale;
    this.scale = newScale;
    this.x = localCx - wx * this.scale;
    this.y = localCy - wy * this.scale;
    this.apply();
    updateStatus();
    renderMinimap();
  },

  fitToContent(map) {
    if (!map || map.count() === 0) {
      this.reset();
      return;
    }
    const b = computeBounds(map.root);
    if (b.width === 0 && b.height === 0) {
      const rect = getCanvasRect();
      this.scale = 1;
      this.x = rect.width / 2 - b.centerX * this.scale;
      this.y = rect.height / 2 - b.centerY * this.scale;
      this.apply();
      updateStatus();
      renderMinimap();
      return;
    }
    const rect = getCanvasRect();
    const padding = 120;
    const scaleX = (rect.width - padding * 2) / Math.max(b.width, 400);
    const scaleY = (rect.height - padding * 2) / Math.max(b.height, 300);
    // 适应屏幕用于快速开始编辑，保留可读性；需要总览时仍可手动缩小。
    this.scale = clamp(Math.min(scaleX, scaleY), Math.max(this.minScale, this.minFitScale), 1);
    this.x = rect.width / 2 - b.centerX * this.scale;
    this.y = rect.height / 2 - b.centerY * this.scale;
    this.apply();
    updateStatus();
    renderMinimap();
  },

  reset() {
    const rect = getCanvasRect();
    this.scale = 1;
    this.x = rect.width / 2;
    this.y = rect.height / 2;
    this.apply();
    updateStatus();
    renderMinimap();
  },
};

/* ============== 状态 ============== */
let mindmap = new MindMap();
let selectedId = null;
let selectedLinkId = null;
let editing = false;
let spaceHeld = false;
// Space 按住期间是否真的平移过（用来区分「折叠快捷键」和「平移修饰键」）
let spacePanned = false;
let activeMode = 'map';
let markdownText = '';
let markdownLastValidText = '';
let markdownNodeLines = new Map();
let markdownLineNodes = new Map();
let markdownParseTimer = null;
let markdownSyncing = false;
let markdownStatusMessage = '已同步';
let markdownStatusType = 'synced';

// 历史记录保存文档结构和自由连线，不保存视口移动。
const HISTORY_LIMIT = 100;
const undoStack = [];
const redoStack = [];

// 新建节点动画标记（renderNodes 消费一次后清空）
window.__pendingNewNodeId = null;

// 节点 id -> DOM 元素，renderNodes 重建；避免连线渲染时逐条全量扫描 DOM。
const nodeElements = new Map();

// 拖拽节点
let draggingNode = null;
let draggingElement = null;
let dragOffset = { x: 0, y: 0 };
let pendingNodeDrag = null;
let dragStartSnapshot = null;

// 平移画布
let panning = false;
let panStart = { x: 0, y: 0, vx: 0, vy: 0 };

// 跨节点拖拽调整层级；连线使用节点端口单独处理。
let crossDrag = null;
let linkDrag = null;
let pendingNodeCreation = null;

/* ============== 文档状态与历史 ============== */
function cloneRoot(root) {
  const clone = JSON.parse(JSON.stringify(root));
  const copyMarkdownSyntax = (source, target) => {
    if (!source || !target) return;
    if (source.__markdownKind) {
      setMarkdownSyntax(
        target,
        source.__markdownKind,
        source.__markdownLevel,
        source.__markdownIndent,
        source.__markdownMarker,
      );
    }
    source.children?.forEach((child, index) => {
      copyMarkdownSyntax(child, target.children?.[index]);
    });
  };
  copyMarkdownSyntax(root, clone);
  return clone;
}

function cloneLinks(links) {
  return (Array.isArray(links) ? links : []).map((link) => ({
    id: link.id,
    from: link.from,
    to: link.to,
    sourcePort: link.sourcePort || link.source_port || 'output',
    targetPort: link.targetPort || link.target_port || 'input',
  }));
}

function captureSnapshot() {
  return {
    root: cloneRoot(mindmap.root),
    links: cloneLinks(mindmap.links),
    selectedId,
    selectedLinkId,
  };
}

function rootsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function linksEqual(a, b) {
  return JSON.stringify(a || []) === JSON.stringify(b || []);
}

let lastHistoryAt = 0;

function recordHistory(label, before, coalesce = false) {
  const after = mindmap.root;
  if (rootsEqual(before.root, after) && linksEqual(before.links, mindmap.links)) return false;

  const now = Date.now();
  const last = undoStack[undoStack.length - 1];
  if (coalesce && last && last.label === label && now - last.time < 800) {
    last.time = now;
  } else {
    undoStack.push({ label, snapshot: before, time: now });
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  }
  redoStack.length = 0;
  lastHistoryAt = now;
  updateHistoryUI();
  return true;
}

function finishMapChange(label, before, options = {}) {
  mindmap.rebuildIndex();
  if (selectedLinkId && !mindmap.links.some((link) => link.id === selectedLinkId)) {
    selectedLinkId = null;
  }
  const changed = recordHistory(label, before, options.coalesce);
  if (changed || options.renderWhenUnchanged) {
    syncMarkdownFromMap();
    render();
    saveState();
    if (hasDocumentContent()) $('#welcome')?.remove();
  }
  if (options.editId) scheduleEdit(options.editId, 80);
  if (options.toast) showToast(options.toast);
  return changed;
}

function commitActiveEdit() {
  if (activeEditCommit) activeEditCommit();
}

function restoreSnapshot(snapshot) {
  if (!snapshot?.root) return;
  mindmap = new MindMap(cloneRoot(snapshot.root), cloneLinks(snapshot.links));
  selectedId = snapshot.selectedId && mindmap.nodes.has(snapshot.selectedId)
    ? snapshot.selectedId
    : null;
  selectedLinkId = snapshot.selectedLinkId && mindmap.links.some((link) => link.id === snapshot.selectedLinkId)
    ? snapshot.selectedLinkId
    : null;
  syncMarkdownFromMap();
  render();
  saveState();
  if (hasDocumentContent()) $('#welcome')?.remove();
}

function undo() {
  commitActiveEdit();
  const item = undoStack.pop();
  if (!item) return;
  redoStack.push({ label: item.label, snapshot: captureSnapshot(), time: Date.now() });
  restoreSnapshot(item.snapshot);
  updateHistoryUI();
  showToast(`已撤销：${item.label}`);
}

function redo() {
  commitActiveEdit();
  const item = redoStack.pop();
  if (!item) return;
  undoStack.push({ label: item.label, snapshot: captureSnapshot(), time: Date.now() });
  restoreSnapshot(item.snapshot);
  updateHistoryUI();
  showToast(`已重做：${item.label}`);
}

function updateHistoryUI() {
  const undoBtn = $('#btn-undo');
  const redoBtn = $('#btn-redo');
  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

/* ============== Markdown 双向同步 ============== */
function setMarkdownStatus(message, type = 'synced') {
  markdownStatusMessage = message;
  markdownStatusType = type;
  const status = $('#markdown-status');
  if (!status) return;
  status.textContent = message;
  status.dataset.state = type;
}

function updateMarkdownGutter() {
  const editor = $('#markdown-editor');
  const gutter = $('#md-gutter');
  if (!editor || !gutter) return;
  const lineCount = Math.max(1, editor.value.split('\n').length);
  gutter.textContent = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');
}

function updateMarkdownLineMapsFromTree(root) {
  const lineMap = new Map();
  const walk = (node) => {
    if (Number.isInteger(node.__sourceLine)) lineMap.set(node.id, node.__sourceLine);
    node.children.forEach(walk);
  };
  walk(root);
  if (lineMap.size === 0) lineMap.set(root.id, 0);
  markdownNodeLines = lineMap;
  markdownLineNodes = new Map();
  lineMap.forEach((line, id) => markdownLineNodes.set(line, id));
}

function updateMarkdownEditorValue(value, selection = null) {
  const editor = $('#markdown-editor');
  if (!editor) {
    updateMarkdownGutter();
    return;
  }

  const isFocused = document.activeElement === editor;
  const start = selection?.start ?? editor.selectionStart;
  const end = selection?.end ?? editor.selectionEnd;
  if (editor.value === value) {
    if (isFocused && selection) {
      editor.setSelectionRange(
        clamp(start, 0, value.length),
        clamp(end, 0, value.length),
      );
    }
    updateMarkdownGutter();
    return;
  }
  editor.value = value;
  if (isFocused) {
    const nextStart = clamp(start, 0, value.length);
    const nextEnd = clamp(end, 0, value.length);
    editor.setSelectionRange(nextStart, nextEnd);
  }
  updateMarkdownGutter();
}

function syncMarkdownFromMap() {
  const data = mindmap.toMarkdownData();
  markdownText = data.text;
  markdownLastValidText = data.text;
  markdownNodeLines = data.nodeLines;
  markdownLineNodes = new Map();
  data.nodeLines.forEach((line, id) => markdownLineNodes.set(line, id));
  updateMarkdownEditorValue(data.text);
  clearMarkdownError();
  setMarkdownStatus('已同步', 'synced');
}

function clearMarkdownError() {
  const error = $('#markdown-error');
  if (!error) return;
  error.textContent = '';
  delete error.dataset.state;
  error.classList.add('hidden');
}

function clearMarkdownLineMaps() {
  markdownNodeLines = new Map();
  markdownLineNodes = new Map();
}

function renderMarkdownDiagnostics(diagnostics) {
  const errors = diagnostics.filter((item) => item.severity === 'error');
  const warnings = diagnostics.filter((item) => item.severity === 'warning');
  const infos = diagnostics.filter((item) => item.severity === 'info');
  const error = $('#markdown-error');
  if (error) {
    const visibleDiagnostics = errors.length > 0 ? errors
      : warnings.length > 0 ? warnings
        : infos;
    const state = errors.length > 0 ? 'error'
      : warnings.length > 0 ? 'warning'
        : infos.length > 0 ? 'info' : '';
    if (state) error.dataset.state = state;
    else delete error.dataset.state;
    error.textContent = visibleDiagnostics.map((item) => (
      Number.isInteger(item.line) ? `第 ${item.line} 行：${item.message}` : item.message
    )).join('；');
    error.classList.toggle('hidden', visibleDiagnostics.length === 0);
  }
  if (errors.length > 0) {
    setMarkdownStatus('解析失败', 'error');
  } else if (warnings.length > 0) {
    setMarkdownStatus('已应用，有提示', 'warning');
  } else if (infos.length > 0) {
    setMarkdownStatus('已自动整理', 'info');
  } else {
    setMarkdownStatus('已同步', 'synced');
  }
}

function normalizedNodeText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function reconcileNode(parsed, previous, parent = null, index = 0, preservePrevious = true) {
  const hasPrevious = preservePrevious && !!previous;
  const node = {
    id: hasPrevious ? previous.id : uid(),
    text: parsed.text || '空',
    x: hasPrevious
      ? previous.x
      : (Number.isFinite(parsed.x) && (parsed.x !== 0 || !parent)
        ? parsed.x
        : (parent ? parent.x + 240 : 0)),
    y: hasPrevious
      ? previous.y
      : (Number.isFinite(parsed.y) && (parsed.y !== 0 || !parent)
        ? parsed.y
        : (parent ? parent.y + index * 72 : 0)),
    children: [],
    collapsed: hasPrevious ? !!previous.collapsed : false,
  };
  if (Number.isInteger(parsed.__sourceLine)) setSourceLine(node, parsed.__sourceLine);
  const syntaxSource = parsed.__markdownKind ? parsed : previous;
  if (syntaxSource?.__markdownKind) {
    setMarkdownSyntax(
      node,
      syntaxSource.__markdownKind,
      syntaxSource.__markdownLevel,
      syntaxSource.__markdownIndent,
      syntaxSource.__markdownMarker,
    );
  }

  const oldChildren = previous?.children || [];
  const used = new Set();
  node.children = parsed.children.map((child, childIndex) => {
    const text = normalizedNodeText(child.text);
    let matchIndex = oldChildren.findIndex((oldChild, oldIndex) => (
      !used.has(oldIndex) && normalizedNodeText(oldChild.text) === text
    ));
    if (matchIndex < 0 && oldChildren[childIndex] && !used.has(childIndex)) {
      matchIndex = childIndex;
    }
    const match = matchIndex >= 0 ? oldChildren[matchIndex] : null;
    if (matchIndex >= 0) used.add(matchIndex);
    return reconcileNode(child, match, node, childIndex, preservePrevious);
  });
  return node;
}

function reconcileParsedTree(parsedRoot, previousRoot, preservePrevious = true) {
  const root = reconcileNode(parsedRoot, previousRoot, null, 0, preservePrevious);
  updateMarkdownLineMapsFromTree(root);
  return root;
}

function applyMarkdownText(value, options = {}) {
  // Markdown 应用会替换当前节点树，先提交可能仍在画布上的编辑内容。
  commitActiveEdit();
  const editor = $('#markdown-editor');
  const selection = editor && document.activeElement === editor
    ? { start: editor.selectionStart, end: editor.selectionEnd }
    : null;
  const normalized = normalizeMarkdown(value, selection);
  const parsed = parseMarkdown(normalized.text);
  const diagnostics = [...parsed.diagnostics];
  if (normalized.convertedCount > 0) {
    diagnostics.unshift({
      message: `已自动将 ${normalized.convertedCount} 行普通文本转换为列表节点`,
      severity: 'info',
    });
  }
  markdownText = normalized.text;
  updateMarkdownEditorValue(normalized.text, normalized.selection);
  renderMarkdownDiagnostics(diagnostics);
  if (!parsed.valid) {
    clearMarkdownLineMaps();
    saveState();
    return false;
  }

  markdownNeedsMigration = false;

  const before = captureSnapshot();
  const shouldAutoLayout = options.forceLayout
    || options.preservePrevious === false
    || mindmap.root.children.length === 0
    || normalized.convertedCount > 0;
  const previousLinks = mindmap.links;
  const nextRoot = reconcileParsedTree(
    parsed.root,
    mindmap.root,
    options.preservePrevious !== false,
  );
  if (shouldAutoLayout) autoLayout(nextRoot);
  mindmap = new MindMap(
    nextRoot,
    options.preservePrevious !== false ? previousLinks : [],
  );
  if (selectedId && !mindmap.nodes.has(selectedId)) selectedId = null;
  if (selectedLinkId && !mindmap.links.some((link) => link.id === selectedLinkId)) {
    selectedLinkId = null;
  }
  markdownLastValidText = normalized.text;
  updateMarkdownLineMapsFromTree(mindmap.root);
  recordHistory(options.label || '编辑 Markdown', before, options.coalesce !== false);
  render();
  saveState();
  if (hasDocumentContent()) $('#welcome')?.remove();
  if (parsed.diagnostics.some((item) => item.severity === 'warning')) {
    setMarkdownStatus('已应用，有提示', 'warning');
  } else if (normalized.convertedCount > 0) {
    setMarkdownStatus(`已自动整理 ${normalized.convertedCount} 行`, 'info');
  } else {
    setMarkdownStatus('已同步', 'synced');
  }
  return true;
}

function applyMarkdownDraft(options = {}) {
  const editor = $('#markdown-editor');
  if (!editor || markdownSyncing) return false;
  return applyMarkdownText(editor.value, options);
}

function restoreSavedMarkdownDraft(savedText) {
  if (typeof savedText !== 'string' || !savedText) return;

  const shouldMigrateMarkdown = markdownNeedsMigration;
  const sourceText = shouldMigrateMarkdown
    ? migrateLegacyListGroups(savedText)
    : savedText;
  const didMigrateMarkdown = sourceText !== savedText;
  const normalized = normalizeMarkdown(sourceText);
  const parsed = parseMarkdown(normalized.text);
  if (!parsed.valid) {
    markdownText = sourceText;
    clearMarkdownLineMaps();
    updateMarkdownEditorValue(sourceText);
    renderMarkdownDiagnostics(parsed.diagnostics);
    return;
  }

  // 保留用户打开文件时的 Markdown 排版，同时复用已保存的节点位置和 ID。
  const previousLinks = mindmap.links;
  const nextRoot = reconcileParsedTree(parsed.root, mindmap.root);
  if (layoutNeedsMigration || didMigrateMarkdown || normalized.convertedCount > 0) {
    autoLayout(nextRoot);
  }
  layoutNeedsMigration = false;
  mindmap = new MindMap(nextRoot, previousLinks);
  if (selectedId && !mindmap.nodes.has(selectedId)) selectedId = null;
  if (selectedLinkId && !mindmap.links.some((link) => link.id === selectedLinkId)) {
    selectedLinkId = null;
  }
  markdownNeedsMigration = false;
  markdownText = normalized.text;
  markdownLastValidText = normalized.text;
  updateMarkdownLineMapsFromTree(mindmap.root);
  updateMarkdownEditorValue(normalized.text);
  const diagnostics = [...parsed.diagnostics];
  if (didMigrateMarkdown) {
    diagnostics.unshift({
      message: '已自动整理旧版列表层级',
      severity: 'info',
    });
  }
  if (normalized.convertedCount > 0) {
    diagnostics.unshift({
      message: `已自动将 ${normalized.convertedCount} 行普通文本转换为列表节点`,
      severity: 'info',
    });
  }
  renderMarkdownDiagnostics(diagnostics);
  if (didMigrateMarkdown || normalized.convertedCount > 0) saveState();
}

function getLineStart(text, line) {
  if (line <= 0) return 0;
  let start = 0;
  for (let i = 0; i < line; i++) {
    const next = text.indexOf('\n', start);
    if (next < 0) return text.length;
    start = next + 1;
  }
  return start;
}

function focusMarkdownNode(id, shouldFocus = false) {
  const editor = $('#markdown-editor');
  const line = markdownNodeLines.get(id);
  if (!editor || !Number.isInteger(line)) return;
  const start = getLineStart(editor.value, line);
  const endIndex = editor.value.indexOf('\n', start);
  const end = endIndex < 0 ? editor.value.length : endIndex;
  editor.setSelectionRange(start, end);
  const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 22;
  editor.scrollTop = Math.max(0, line * lineHeight - editor.clientHeight / 2 + lineHeight);
  if (shouldFocus) editor.focus();
}

function selectNodeFromMarkdownCursor() {
  const editor = $('#markdown-editor');
  if (!editor) return;
  const line = editor.value.slice(0, editor.selectionStart).split('\n').length - 1;
  const id = markdownLineNodes.get(line);
  if (!id || id === selectedId) return;
  selectedId = id;
  selectedLinkId = null;
  renderSelectionOnly();
}

function renderSelectionOnly() {
  $$('.node.selected').forEach((node) => node.classList.remove('selected'));
  const selected = selectedId ? $(`.node[data-id="${selectedId}"]`) : null;
  if (selected) selected.classList.add('selected');
  renderConnections();
  updateNodeToolbar();
}

function setActiveMode(mode, persist = true) {
  if (!['map', 'markdown', 'split'].includes(mode)) mode = 'map';
  if (mode === 'split' && window.innerWidth <= 768) mode = 'markdown';
  // 切换工作区前先提交画布内的 contenteditable，避免隐藏编辑框后状态悬挂。
  commitActiveEdit();
  const previousRect = getCanvasRect();
  const worldCenterX = (previousRect.width / 2 - viewport.x) / viewport.scale;
  const worldCenterY = (previousRect.height / 2 - viewport.y) / viewport.scale;
  activeMode = mode;
  document.body.dataset.mode = mode;
  if (mode !== 'map') $('#welcome')?.remove();
  $$('.mode-btn').forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  const nextRect = getCanvasRect();
  viewport.x = nextRect.width / 2 - worldCenterX * viewport.scale;
  viewport.y = nextRect.height / 2 - worldCenterY * viewport.scale;
  viewport.apply();
  renderMinimap();
  if (mode !== 'map') updateMarkdownGutter();
  if (persist) saveState();
}

/* ============== 渲染 ============== */
function render() {
  mindmap.refreshCollapsedCache();
  renderNodes();
  renderConnections();
  renderOutline();
  renderMinimap();
  updateStatus();
}

function defaultChildPosition(parent) {
  const index = parent.children.length;
  const direction = parent !== mindmap.root && parent.x < mindmap.root.x ? -1 : 1;
  return {
    x: parent.x + direction * 240,
    y: parent.y + index * 72,
  };
}

function addChildNode(parentId, text = '新节点', pos = null, label = '添加子节点') {
  const parent = mindmap.nodes.get(parentId);
  if (!parent) return null;
  const before = captureSnapshot();
  const child = mindmap.addChild(parentId, text, pos || defaultChildPosition(parent));
  if (!child) return null;
  parent.collapsed = false;
  selectedId = child.id;
  selectedLinkId = null;
  window.__pendingNewNodeId = child.id;
  finishMapChange(label, before, { editId: child.id });
  return child;
}

function addSiblingNode(nodeId, text = '新节点') {
  const node = mindmap.nodes.get(nodeId);
  if (!node) return null;
  const parent = mindmap.findParent(node) || mindmap.root;
  const before = captureSnapshot();
  const currentIndex = parent.children.indexOf(node);
  const sibling = mindmap.addChild(parent.id, text, {
    x: node.x,
    y: node.y + 80,
  });
  if (!sibling) return null;

  parent.children.pop();
  const insertIndex = Math.max(0, currentIndex + 1);
  parent.children.splice(insertIndex, 0, sibling);
  parent.children.slice(insertIndex + 1).forEach((item) => { item.y += 80; });
  selectedId = sibling.id;
  selectedLinkId = null;
  window.__pendingNewNodeId = sibling.id;
  finishMapChange('添加同级节点', before, { editId: sibling.id });
  return sibling;
}

function createNodePort(node, type) {
  const port = document.createElement('button');
  port.type = 'button';
  port.className = `node-port node-port-${type}`;
  port.dataset.nodeId = node.id;
  port.dataset.port = type;
  port.setAttribute('aria-label', type === 'output' ? '输出端口' : '输入端口');
  port.title = type === 'output' ? '从这里拖到目标节点的输入端口' : '输入端口';
  port.addEventListener('mousedown', (e) => {
    if (type === 'output') startLinkDrag(e, node.id);
    else if (linkDrag?.persistent) {
      e.preventDefault();
      e.stopPropagation();
      finishLinkDrag(e.clientX, e.clientY);
    } else e.stopPropagation();
  });
  port.addEventListener('touchstart', (e) => {
    if (type === 'output') startLinkDrag(e, node.id);
    else if (linkDrag?.persistent) {
      const touch = e.touches[0];
      e.preventDefault();
      e.stopPropagation();
      finishLinkDrag(touch.clientX, touch.clientY);
    } else e.stopPropagation();
  }, { passive: false });
  port.addEventListener('dblclick', (e) => e.stopPropagation());
  return port;
}

function renderNodes() {
  const container = $('#nodes');
  // 先把可能正在编辑的节点落盘，避免 render 把它从 DOM 摘掉后
  // 没有 blur 事件、导致 `editing` 标志卡死。
  if (activeEditCommit) activeEditCommit();
  container.innerHTML = '';
  nodeElements.clear();

  const walk = (node) => {
    if (node !== mindmap.root && mindmap.isCollapsedAncestor(node)) return;

    const el = document.createElement('div');
    el.className = 'node';
    el.dataset.id = node.id;
    el.dataset.side = node !== mindmap.root && node.x < mindmap.root.x ? 'left' : 'right';
    el.style.left = node.x + 'px';
    el.style.top = node.y + 'px';

    const depth = mindmap.getDepth(node.id);
    el.classList.add(`depth-${Math.min(depth, 6)}`);
    if (node.collapsed) {
      el.classList.add('collapsed');
      const cnt = mindmap.countDescendants(node);
      if (cnt > 0) el.dataset.count = '+' + cnt;
    }
    if (selectedId === node.id) el.classList.add('selected');

    // 文本节点（可编辑）
    const textSpan = document.createElement('span');
    textSpan.className = 'node-text';
    textSpan.textContent = node.text || '空';
    el.appendChild(textSpan);

    // 工作流式输入端口；节点外侧的「+」就是输出端口，拖动它会拉出连线。
    el.appendChild(createNodePort(node, 'input'));

    // Coze 风格输出端口：按住「+」拉线，落到空白处后再选择要创建的节点。
    const addBtn = document.createElement('button');
    addBtn.className = 'node-add-child';
    addBtn.innerHTML = '+';
    addBtn.title = '从这里拖出连线；落到空白处可新建节点';
    addBtn.addEventListener('mousedown', (e) => {
      startLinkDrag(e, node.id, { createNodeOnEmpty: true });
    });
    addBtn.addEventListener('dblclick', (e) => e.stopPropagation());
    addBtn.addEventListener('touchstart', (e) => {
      startLinkDrag(e, node.id, { createNodeOnEmpty: true });
    }, { passive: false });
    addBtn.addEventListener('click', (e) => {
      // 防止浏览器的 click 事件再次触发节点选择；创建动作在连线释放后完成。
      e.stopPropagation();
    });
    el.appendChild(addBtn);

    // 新建节点入场动画（由调用方设置 __pendingNewNodeId 后消费一次）
    if (window.__pendingNewNodeId === node.id) {
      el.classList.add('node-appear');
      window.__pendingNewNodeId = null;
    }

    container.appendChild(el);
    nodeElements.set(node.id, el);
    // 折叠节点只保留自身，不能继续渲染隐藏子树的节点和连线。
    if (node.collapsed) return;
    node.children.forEach(walk);
  };
  walk(mindmap.root);
}

function getNodePortWorldPosition(node, type, side = null) {
  let nodeEl = nodeElements.get(node.id);
  if (nodeEl && !nodeEl.isConnected) nodeEl = null;
  const width = nodeEl?.offsetWidth || (node === mindmap.root ? 160 : 128);
  const isLeft = (side || (node !== mindmap.root && node.x < mindmap.root.x ? 'left' : 'right')) === 'left';
  const edge = type === 'input'
    ? (isLeft ? width / 2 : -width / 2)
    : (isLeft ? -width / 2 : width / 2);
  return {
    x: node.x + edge,
    y: node.y,
  };
}

function getConnectionSide(from, to) {
  return to.x < from.x ? 'left' : 'right';
}

function getConnectionPathData(fromPoint, toPoint, laneOffset = 0) {
  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
    return `M ${fromPoint.x} ${fromPoint.y} L ${toPoint.x} ${toPoint.y}`;
  }

  // 按节点所在侧连接，使用带圆角的正交折线，保证箭头水平进入输入端口。
  const direction = dx >= 0 ? 1 : -1;
  const absDx = Math.abs(dx);
  if (absDx >= 48) {
    const baseMiddleX = fromPoint.x + dx / 2;
    const minMiddleX = Math.min(fromPoint.x, toPoint.x) + 24;
    const maxMiddleX = Math.max(fromPoint.x, toPoint.x) - 24;
    const middleX = clamp(baseMiddleX + laneOffset, minMiddleX, maxMiddleX);
    const radius = Math.min(12, absDx / 4, Math.abs(dy) / 2);
    if (radius < 1) {
      return `M ${fromPoint.x} ${fromPoint.y} H ${toPoint.x}`;
    }
    const firstCornerX = middleX - direction * radius;
    const secondCornerX = middleX + direction * radius;
    const verticalDirection = dy >= 0 ? 1 : -1;
    const verticalStartY = fromPoint.y + verticalDirection * radius;
    const verticalEndY = toPoint.y - verticalDirection * radius;
    return [
      `M ${fromPoint.x} ${fromPoint.y}`,
      `H ${firstCornerX}`,
      `Q ${middleX} ${fromPoint.y} ${middleX} ${verticalStartY}`,
      `V ${verticalEndY}`,
      `Q ${middleX} ${toPoint.y} ${secondCornerX} ${toPoint.y}`,
      `H ${toPoint.x}`,
    ].join(' ');
  }

  // 端口距离很近时退回短曲线，避免折线拐角挤在节点边缘。
  const curve = Math.max(22, Math.min(80, absDx * 0.5 + 20));
  const cp1x = fromPoint.x + direction * curve;
  const cp2x = toPoint.x - direction * curve;
  return `M ${fromPoint.x} ${fromPoint.y} C ${cp1x} ${fromPoint.y}, ${cp2x} ${toPoint.y}, ${toPoint.x} ${toPoint.y}`;
}

function getConnectionLaneOffset(source, target, linkId = null) {
  const outgoing = source.children.map((child) => `tree:${child.id}`);
  mindmap.links.forEach((link) => {
    if (link.from === source.id) outgoing.push(`free:${link.id}`);
  });
  const key = linkId ? `free:${linkId}` : `tree:${target.id}`;
  const index = outgoing.indexOf(key);
  const count = outgoing.length;
  if (index < 0 || count < 2) return 0;

  // 同一个输出端的多条边使用独立通道，避免竖向段完全重叠。
  const gap = Math.min(28, 180 / (count - 1));
  return (index - (count - 1) / 2) * gap;
}

function appendConnectionDefs(svg) {
  const defs = document.createElementNS(SVG_NS, 'defs');
  const marker = document.createElementNS(SVG_NS, 'marker');
  marker.id = 'connection-arrow';
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '8');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '7');
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('orient', 'auto-start-reverse');
  const arrow = document.createElementNS(SVG_NS, 'path');
  arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  arrow.setAttribute('fill', 'context-stroke');
  marker.appendChild(arrow);
  defs.appendChild(marker);
  svg.appendChild(defs);
}

function applyConnectionState(path, fromId, toId, linkId = null) {
  path.dataset.from = fromId;
  path.dataset.to = toId;
  path.setAttribute('marker-end', 'url(#connection-arrow)');
  if (selectedId === fromId || selectedId === toId || (linkId && selectedLinkId === linkId)) {
    path.classList.add('highlighted');
  }
  return path;
}

function renderConnections() {
  const svg = $('#connections');
  svg.innerHTML = '';
  appendConnectionDefs(svg);

  const walk = (node) => {
    if (mindmap.isCollapsedAncestor(node) || node.collapsed) return;
    const children = node.children.filter((child) => !mindmap.isCollapsedAncestor(child));
    createTreeConnectionPaths(node).forEach((path) => svg.appendChild(path));
    children.forEach(walk);
  };
  walk(mindmap.root);
  renderFreeConnections(svg);
  if (linkDrag) renderLinkDragPreview(linkDrag.currentX, linkDrag.currentY);
  if (pendingNodeCreation) renderPendingNodePreview();
}

function createConnectionPath(from, to) {
  const side = getConnectionSide(from, to);
  const fromPoint = getNodePortWorldPosition(from, 'output', side);
  const toPoint = getNodePortWorldPosition(to, 'input', side);
  const path = SVG_PATH(getConnectionPathData(
    fromPoint,
    toPoint,
    getConnectionLaneOffset(from, to),
  ));
  path.dataset.depth = mindmap.getDepth(to.id);
  path.dataset.edgeKind = 'tree';
  return applyConnectionState(path, from.id, to.id);
}

function createTreeConnectionPaths(from) {
  const children = from.children.filter((child) => !mindmap.isCollapsedAncestor(child));
  if (children.length < 2) {
    return children.map((child) => createConnectionPath(from, child));
  }

  const leftChildren = children.filter((child) => child.x < from.x - 18);
  const rightChildren = children.filter((child) => child.x > from.x + 18);
  if (leftChildren.length + rightChildren.length !== children.length) {
    return children.map((child) => createConnectionPath(from, child));
  }

  const createBranchPaths = (sideChildren, side) => {
    if (sideChildren.length < 2) {
      return sideChildren.map((child) => createConnectionPath(from, child));
    }

    const fromPoint = getNodePortWorldPosition(from, 'output', side);
    const childPoints = sideChildren.map((child) => ({
      child,
      point: getNodePortWorldPosition(child, 'input', side),
    }));
    const nearestChildX = side === 'left'
      ? Math.max(...childPoints.map(({ point }) => point.x))
      : Math.min(...childPoints.map(({ point }) => point.x));
    const branchSpace = side === 'left'
      ? fromPoint.x - nearestChildX
      : nearestChildX - fromPoint.x;
    if (branchSpace <= 28) {
      return sideChildren.map((child) => createConnectionPath(from, child));
    }

    // 多个子节点共享一条父级干线，再从干线分叉，避免每条边都重复穿过同一通道。
    const trunkOffset = clamp(branchSpace * 0.48, 18, 96);
    const trunkX = fromPoint.x + (side === 'left' ? -trunkOffset : trunkOffset);
    const trunkTooClose = side === 'left'
      ? trunkX <= nearestChildX + 8
      : trunkX >= nearestChildX - 8;
    if (trunkTooClose) {
      return sideChildren.map((child) => createConnectionPath(from, child));
    }

    const topY = Math.min(...childPoints.map(({ point }) => point.y));
    const bottomY = Math.max(...childPoints.map(({ point }) => point.y));
    const depth = Math.min(6, mindmap.getDepth(from.id));
    const trunk = SVG_PATH([
      `M ${fromPoint.x} ${fromPoint.y}`,
      `H ${trunkX}`,
      `M ${trunkX} ${topY}`,
      `V ${bottomY}`,
    ].join(' '), 'connection tree-trunk');
    trunk.dataset.depth = String(depth);
    trunk.dataset.edgeKind = 'tree-trunk';
    if (selectedId === from.id || sideChildren.some((child) => child.id === selectedId)) {
      trunk.classList.add('highlighted');
    }

    const paths = [trunk];
    childPoints.forEach(({ child, point }) => {
      const branch = SVG_PATH(`M ${trunkX} ${point.y} H ${point.x}`, 'connection tree-branch');
      branch.dataset.depth = String(Math.min(6, mindmap.getDepth(child.id)));
      branch.dataset.edgeKind = 'tree';
      paths.push(applyConnectionState(branch, from.id, child.id));
    });
    return paths;
  };

  return [
    ...createBranchPaths(leftChildren, 'left'),
    ...createBranchPaths(rightChildren, 'right'),
  ];
}

function createFreeConnectionPath(link, from, to) {
  const side = getConnectionSide(from, to);
  const fromPoint = getNodePortWorldPosition(from, link.sourcePort || 'output', side);
  const toPoint = getNodePortWorldPosition(to, link.targetPort || 'input', side);
  const path = SVG_PATH(
    getConnectionPathData(fromPoint, toPoint, getConnectionLaneOffset(from, to, link.id)),
    'connection free',
  );
  path.dataset.linkId = link.id;
  path.dataset.edgeKind = 'free';
  return applyConnectionState(path, from.id, to.id, link.id);
}

function renderPendingNodePreview() {
  const pending = pendingNodeCreation;
  if (!pending) return;
  const source = mindmap.nodes.get(pending.sourceId);
  if (!source) return;
  const svg = $('#connections');
  const path = SVG_PATH(
    getConnectionPathData(
      getNodePortWorldPosition(source, 'output'),
      { x: pending.x, y: pending.y },
    ),
    'connection link-preview pending-node-preview',
  );
  path.id = 'pending-node-preview';
  path.setAttribute('marker-end', 'url(#connection-arrow)');
  svg.appendChild(path);
}

function renderFreeConnections(svg, onlyNode = null) {
  mindmap.links.forEach((link) => {
    if (onlyNode && link.from !== onlyNode.id && link.to !== onlyNode.id) return;
    const from = mindmap.nodes.get(link.from);
    const to = mindmap.nodes.get(link.to);
    if (
      !from
      || !to
      || from.collapsed
      || to.collapsed
      || mindmap.isCollapsedAncestor(from)
      || mindmap.isCollapsedAncestor(to)
    ) return;
    svg.appendChild(createFreeConnectionPath(link, from, to));
  });
}

function renderOutline() {
  const container = $('#outline');
  container.innerHTML = '';
  const walk = (node, depth) => {
    if (depth > 5) return;
    if (node !== mindmap.root && mindmap.isCollapsedAncestor(node)) return;
    const item = document.createElement('div');
    item.className = `outline-item depth-${Math.min(depth, 3)}`;
    item.textContent = node.text || '(空)';
    item.dataset.id = node.id;
    item.addEventListener('click', () => focusNode(node.id));
    container.appendChild(item);
    node.children.forEach((c) => walk(c, depth + 1));
  };
  walk(mindmap.root, 0);
}

function renderMinimap() {
  const minimap = $('#minimap');
  if (!minimap) return;
  minimap.innerHTML = '';
  const bounds = computeBounds(mindmap.root);

  const padding = 8;
  const w = minimap.clientWidth - padding * 2;
  const h = minimap.clientHeight - padding * 2;
  if (w <= 0 || h <= 0) return;
  const contentWidth = Math.max(bounds.width, 100);
  const contentHeight = Math.max(bounds.height, 100);
  const s = Math.min(w / contentWidth, h / contentHeight);
  const ox = padding + w / 2 - bounds.centerX * s;
  const oy = padding + h / 2 - bounds.centerY * s;

  const walk = (node, depth = 0) => {
    if (mindmap.isCollapsedAncestor(node)) return;
    const el = document.createElement('div');
    el.className = 'minimap-node' + (depth === 0 ? ' depth-0' : '');
    const size = depth === 0 ? 5 : 3;
    el.style.left = (ox + node.x * s) + 'px';
    el.style.top = (oy + node.y * s) + 'px';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    minimap.appendChild(el);
    node.children.forEach((c) => walk(c, depth + 1));
  };
  walk(mindmap.root);

  // 视口指示
  const vp = document.createElement('div');
  vp.className = 'minimap-viewport';
  const canvasRect = getCanvasRect();
  const viewLeft = (-viewport.x / viewport.scale) * s + ox;
  const viewTop = (-viewport.y / viewport.scale) * s + oy;
  const viewW = (canvasRect.width / viewport.scale) * s;
  const viewH = (canvasRect.height / viewport.scale) * s;
  vp.style.left = Math.max(0, viewLeft) + 'px';
  vp.style.top = Math.max(0, viewTop) + 'px';
  vp.style.width = Math.min(viewW, w) + 'px';
  vp.style.height = Math.min(viewH, h) + 'px';
  minimap.appendChild(vp);
}

let minimapRafId = null;
function scheduleMinimapRender() {
  if (minimapRafId) return;
  minimapRafId = requestAnimationFrame(() => {
    minimapRafId = null;
    renderMinimap();
  });
}

function updateStatus() {
  const zoomEl = $('#zoom-info');
  const nodeEl = $('#node-info');
  const statusEl = $('#status-info');
  if (zoomEl) zoomEl.textContent = Math.round(viewport.scale * 100) + '%';
  if (nodeEl) nodeEl.textContent = mindmap.count() + ' 个节点';
  if (statusEl) {
    statusEl.textContent = markdownStatusType === 'error'
      ? `Markdown ${markdownStatusMessage}`
      : '单击选中 · 再点取消 · 双击编辑 · 从输出端口拖到输入端口连线 · Space+拖拽平移';
  }
  updateNodeToolbar();
}

/* ============== 节点底部浮动工具栏 ============== */
function updateNodeToolbar() {
  const bar = $('#node-toolbar');
  if (!bar) return;
  if (!selectedId || editing) {
    bar.classList.add('hidden');
    return;
  }
  const node = mindmap.nodes.get(selectedId);
  if (!node || (node !== mindmap.root && mindmap.isCollapsedAncestor(node))) {
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');
  // 屏幕坐标 = 世界坐标 × scale + viewport 偏移
  const rect = getCanvasRect();
  const sx = node.x * viewport.scale + viewport.x + rect.left;
  const sy = node.y * viewport.scale + viewport.y + rect.top;
  bar.style.left = sx + 'px';
  bar.style.top = (sy + 50 * viewport.scale) + 'px';
}

function bindNodeToolbar() {
  const bar = $('#node-toolbar');
  if (!bar) return;
  $$('.node-tool-btn', bar).forEach((btn) => {
    btn.addEventListener('mousedown', (e) => e.stopPropagation());
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!selectedId) return;
      handleToolAction(btn.dataset.action, selectedId);
    });
  });
}

function getCanvasWorldPoint(clientX, clientY) {
  const rect = getCanvasRect();
  return {
    x: (clientX - rect.left - viewport.x) / viewport.scale,
    y: (clientY - rect.top - viewport.y) / viewport.scale,
  };
}

function getCanvasClientPoint(x, y) {
  const rect = getCanvasRect();
  return {
    clientX: rect.left + x * viewport.scale + viewport.x,
    clientY: rect.top + y * viewport.scale + viewport.y,
  };
}

function getInputPortAtPoint(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY);
  const port = target?.closest?.('.node-port-input');
  if (port?.dataset.nodeId) return port;
  const node = target?.closest?.('.node');
  if (!node || node.dataset.id === linkDrag?.sourceId) return null;
  return node.querySelector('.node-port-input');
}

function updateLinkDragTarget(clientX, clientY) {
  $$('.node-port.link-target').forEach((port) => port.classList.remove('link-target'));
  const port = getInputPortAtPoint(clientX, clientY);
  if (port && port.dataset.nodeId !== linkDrag?.sourceId) port.classList.add('link-target');
  return port;
}

function renderLinkDragPreview(clientX, clientY) {
  if (!linkDrag) return;
  const source = mindmap.nodes.get(linkDrag.sourceId);
  if (!source) return;
  const svg = $('#connections');
  let path = $('#link-drag-preview');
  if (!path) {
    path = SVG_PATH('', 'connection link-preview');
    path.id = 'link-drag-preview';
    path.setAttribute('marker-end', 'url(#connection-arrow)');
    svg.appendChild(path);
  }
  const targetPort = updateLinkDragTarget(clientX, clientY);
  const targetNode = targetPort ? mindmap.nodes.get(targetPort.dataset.nodeId) : null;
  const side = targetNode ? getConnectionSide(source, targetNode) : null;
  const fromPoint = getNodePortWorldPosition(source, 'output', side);
  const toPoint = targetNode
    ? getNodePortWorldPosition(targetNode, 'input', side)
    : getCanvasWorldPoint(clientX, clientY);
  path.setAttribute('d', getConnectionPathData(fromPoint, toPoint));
}

function clearLinkDrag() {
  linkDrag = null;
  $('#link-drag-preview')?.remove();
  $$('.node.link-drawing').forEach((node) => node.classList.remove('link-drawing'));
  $$('.node-port.link-target').forEach((port) => port.classList.remove('link-target'));
  $('#drag-hint')?.classList.add('hidden');
}

function startLinkDrag(event, sourceId, options = {}) {
  const point = event.touches?.[0] || event;
  if (!point || !mindmap.nodes.has(sourceId)) return;
  event.preventDefault();
  event.stopPropagation();
  closeNodePicker();
  linkDrag = {
    sourceId,
    currentX: point.clientX,
    currentY: point.clientY,
    createNodeOnEmpty: !!options.createNodeOnEmpty,
    startX: point.clientX,
    startY: point.clientY,
    moved: false,
    persistent: false,
  };
  selectedId = sourceId;
  selectedLinkId = null;
  $$('.node.selected').forEach((node) => node.classList.remove('selected'));
  $(`.node[data-id="${sourceId}"]`)?.classList.add('selected', 'link-drawing');
  const hint = $('#drag-hint');
  const label = $('span', hint);
  if (label) label.textContent = '拖到目标节点的输入端口，松开鼠标完成连线 · Esc 取消';
  hint.classList.remove('hidden');
  hint.style.left = point.clientX + 'px';
  hint.style.top = point.clientY + 'px';
  renderConnections();
}

function startPersistentLink(sourceId) {
  const source = mindmap.nodes.get(sourceId);
  if (!source) return;
  closeNodePicker();
  const initialPoint = getCanvasClientPoint(source.x + 220, source.y);
  linkDrag = {
    sourceId,
    currentX: initialPoint.clientX,
    currentY: initialPoint.clientY,
    createNodeOnEmpty: true,
    startX: initialPoint.clientX,
    startY: initialPoint.clientY,
    moved: false,
    persistent: true,
  };
  selectedId = sourceId;
  selectedLinkId = null;
  $$('.node.selected').forEach((node) => node.classList.remove('selected'));
  $(`.node[data-id="${sourceId}"]`)?.classList.add('selected', 'link-drawing');
  const hint = $('#drag-hint');
  const label = $('span', hint);
  if (label) label.textContent = '点击目标节点输入端口完成连线，点击空白处添加节点 · Esc 取消';
  hint.classList.remove('hidden');
  renderConnections();
}

function updateLinkDrag(clientX, clientY) {
  if (!linkDrag) return;
  linkDrag.currentX = clientX;
  linkDrag.currentY = clientY;
  if (Math.hypot(clientX - linkDrag.startX, clientY - linkDrag.startY) >= 5) {
    linkDrag.moved = true;
  }
  const hint = $('#drag-hint');
  hint.classList.remove('hidden');
  hint.style.left = clientX + 'px';
  hint.style.top = clientY + 'px';
  renderLinkDragPreview(clientX, clientY);
}

function hideNodePicker() {
  $('#node-picker')?.classList.add('hidden');
}

function closeNodePicker() {
  pendingNodeCreation = null;
  hideNodePicker();
  renderConnections();
}

function openNodePicker(sourceId, x, y, clientX, clientY) {
  const picker = $('#node-picker');
  if (!picker) return;
  pendingNodeCreation = { sourceId, x, y, clientX, clientY };
  const input = $('#node-picker-input');
  if (input) input.value = '';
  picker.classList.remove('hidden');
  const width = picker.offsetWidth || 250;
  const height = picker.offsetHeight || 150;
  picker.style.left = clamp(clientX + 14, 12, window.innerWidth - width - 12) + 'px';
  picker.style.top = clamp(clientY + 14, 12, window.innerHeight - height - 12) + 'px';
  renderConnections();
  requestAnimationFrame(() => input?.focus());
}

function createPendingNode() {
  const pending = pendingNodeCreation;
  if (!pending) return false;
  const source = mindmap.nodes.get(pending.sourceId);
  if (!source) {
    closeNodePicker();
    return false;
  }
  const input = $('#node-picker-input');
  const text = input?.value.trim() || '新节点';
  const before = captureSnapshot();
  const node = mindmap.addChild(pending.sourceId, text, {
    x: pending.x,
    y: pending.y,
    radius: 0,
  });
  if (!node) return false;
  source.collapsed = false;
  pendingNodeCreation = null;
  hideNodePicker();
  selectedId = node.id;
  selectedLinkId = null;
  window.__pendingNewNodeId = node.id;
  finishMapChange('通过连线添加节点', before, { editId: node.id });
  return true;
}

function createFreeLink(fromId, toId) {
  const before = captureSnapshot();
  const link = mindmap.addLink(fromId, toId, 'output', 'input');
  if (!link) {
    clearLinkDrag();
    render();
    showToast('无法连线：连线已存在、目标无效，或会形成循环');
    return false;
  }
  clearLinkDrag();
  selectedId = null;
  selectedLinkId = link.id;
  finishMapChange('创建工作流连线', before);
  showToast('已创建连线，点击连线后按 Delete 可删除');
  return true;
}

function removeSelectedLink() {
  if (!selectedLinkId) return false;
  const before = captureSnapshot();
  const removed = mindmap.removeLink(selectedLinkId);
  if (!removed) {
    selectedLinkId = null;
    renderSelectionOnly();
    return false;
  }
  selectedLinkId = null;
  finishMapChange('删除工作流连线', before);
  showToast('已删除连线');
  return true;
}

function finishLinkDrag(clientX, clientY, cancel = false) {
  if (!linkDrag) return;
  const drag = linkDrag;
  const targetPort = cancel ? null : getInputPortAtPoint(clientX, clientY);
  clearLinkDrag();
  if (!targetPort) {
    if (!cancel && drag.createNodeOnEmpty && !drag.moved) {
      startPersistentLink(drag.sourceId);
      return;
    }
    if (!cancel && drag.createNodeOnEmpty) {
      const source = mindmap.nodes.get(drag.sourceId);
      let point = getCanvasWorldPoint(clientX, clientY);
      if (source && Math.hypot(point.x - source.x, point.y - source.y) < 48) {
        point = { x: source.x + 240, y: source.y };
      }
      openNodePicker(drag.sourceId, point.x, point.y, clientX, clientY);
      return;
    }
    renderConnections();
    return;
  }
  createFreeLink(drag.sourceId, targetPort.dataset.nodeId);
}

function setCrossDragHint() {
  const hint = $('#drag-hint');
  const label = $('span', hint);
  if (label) label.textContent = '松开鼠标挂到目标节点下';
}

function handleToolAction(action, id) {
  const node = mindmap.nodes.get(id);
  if (!node) return;

  switch (action) {
    case 'add-child': {
      addChildNode(id);
      break;
    }
    case 'add-sibling': {
      addSiblingNode(id);
      break;
    }
    case 'link': {
      startPersistentLink(id);
      break;
    }
    case 'add-parent': {
      const oldParent = mindmap.findParent(node);
      if (!oldParent || oldParent === mindmap.root) {
        showToast('根节点已是顶层');
        return;
      }

      // 新的树边会把旧父级连到新父级、再连到当前节点；先检查反向自由连线，
      // 避免添加父级后在工作流 DAG 中形成循环。
      if (mindmap.hasPath(node.id, oldParent.id)) {
        showToast('无法添加父级：会形成循环');
        return;
      }

      const before = captureSnapshot();
      const index = oldParent.children.indexOf(node);
      const newParent = mindmap.addChild(oldParent.id, '新父级', {
        x: oldParent.x + (node.x - oldParent.x) / 2,
        y: node.y - 72,
        radius: 0,
      });
      if (!newParent) return;

      // addChild 会先把新节点追加到末尾，再替换当前节点原来的位置，
      // 这样原父级的其他兄弟节点和顺序都不会改变。
      oldParent.children.pop();
      oldParent.children.splice(Math.max(0, index), 1, newParent);
      newParent.children.push(node);
      selectedId = newParent.id;
      window.__pendingNewNodeId = newParent.id;
      finishMapChange('添加父级节点', before, { editId: newParent.id });
      break;
    }
    case 'duplicate': {
      // 根节点没有父级，复制会把整张脑图挂到它自己下面。
      if (id === mindmap.root.id) {
        showToast('根节点不能复制');
        return;
      }
      const before = captureSnapshot();
      const clone = deepCloneNode(node);
      if (!clone) return;
      clone.x = node.x + 50;
      clone.y = node.y + 50;
      const targetParent = mindmap.findParent(node) || mindmap.root;
      targetParent.children.push(clone);
      mindmap.rebuildIndex();
      selectedId = clone.id;
      window.__pendingNewNodeId = clone.id;
      finishMapChange('复制节点', before, { editId: clone.id });
      showToast('已复制');
      break;
    }
    case 'collapse': {
      if (node.children.length === 0) {
        showToast('该节点没有子节点');
        return;
      }
      const before = captureSnapshot();
      node.collapsed = !node.collapsed;
      finishMapChange(node.collapsed ? '折叠节点' : '展开节点', before);
      break;
    }
    case 'delete': {
      if (id === mindmap.root.id) return;
      const before = captureSnapshot();
      const parent = mindmap.findParent(node);
      mindmap.remove(id);
      selectedId = parent?.id || null;
      finishMapChange('删除节点', before);
      showToast('已删除');
      break;
    }
  }
}

function deepCloneNode(node) {
  // 简易深拷贝（节点结构简单，不处理循环引用）
  const clone = {
    id: 'n' + Math.random().toString(36).slice(2, 10),
    text: node.text,
    x: node.x,
    y: node.y,
    children: [],
    collapsed: false,
  };
  clone.children = node.children.map(deepCloneNode);
  return clone;
}

function focusNode(id) {
  const node = mindmap.nodes.get(id);
  if (!node) return;
  selectedId = id;
  selectedLinkId = null;
  const rect = getCanvasRect();
  viewport.x = rect.width / 2 - node.x * viewport.scale;
  viewport.y = rect.height / 2 - node.y * viewport.scale;
  viewport.apply();
  render();
  if (activeMode !== 'map') focusMarkdownNode(id, activeMode === 'markdown');
}

/* ============== 节点位置局部更新（拖拽时性能优化） ============== */
function updateDragVisuals(node) {
  const el = $(`.node[data-id="${node.id}"]`);
  if (el) {
    el.style.left = node.x + 'px';
    el.style.top = node.y + 'px';
  }
  // 仅增量更新被拖拽节点相关的连线（消除每帧全量重绘的抖动）
  updateDragConnectionsFor(node);
  scheduleMinimapRender();
}

function updateDragConnectionsFor(node) {
  const svg = $('#connections');
  // 仅清除受影响 path
  svg.querySelectorAll(`[data-from="${node.id}"], [data-to="${node.id}"]`).forEach((p) => p.remove());

  // 父节点 → 当前节点
  const parent = mindmap.findParent(node);
  if (parent && !mindmap.isCollapsedAncestor(parent)) {
    const path = createConnectionPath(parent, node);
    svg.appendChild(path);
  }

  // 当前节点 → 直接子节点
  node.children.forEach((child) => {
    if (!mindmap.isCollapsedAncestor(child)) {
      const path = createConnectionPath(node, child);
      svg.appendChild(path);
    }
  });
  renderFreeConnections(svg, node);
}

/* ============== 事件绑定 ============== */
function setupEvents() {
  const vp = $('#canvas-viewport');

  bindNodeToolbar();

  const nodePicker = $('#node-picker');
  const nodePickerInput = $('#node-picker-input');
  $('#node-picker-create')?.addEventListener('click', () => createPendingNode());
  $('#node-picker-cancel')?.addEventListener('click', () => closeNodePicker());
  nodePicker?.addEventListener('mousedown', (e) => e.stopPropagation());
  nodePicker?.addEventListener('click', (e) => e.stopPropagation());
  nodePickerInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      createPendingNode();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeNodePicker();
    }
    e.stopPropagation();
  });

  // 滚轮缩放
  vp.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    viewport.zoomAt(factor, e.clientX, e.clientY);
  }, { passive: false });

  // 触屏双指 pinch 缩放
  let lastPinchDist = 0;
  vp.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      lastPinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      return;
    }
    if (e.touches.length === 1) {
      const isOnEmpty = !e.target.closest?.('.node, .node-toolbar, .context-menu');
      if (isOnEmpty) {
        if (pendingNodeCreation) {
          closeNodePicker();
          return;
        }
        if (linkDrag?.persistent) {
          const drag = linkDrag;
          const touch = e.touches[0];
          const point = getCanvasWorldPoint(touch.clientX, touch.clientY);
          clearLinkDrag();
          openNodePicker(drag.sourceId, point.x, point.y, touch.clientX, touch.clientY);
          return;
        }
        panning = true;
        panStart = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          vx: viewport.x,
          vy: viewport.y,
        };
        vp.classList.add('panning');
        deselectAll();
      }
    }
  }, { passive: true });
  vp.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastPinchDist > 0) {
        const factor = dist / lastPinchDist;
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        viewport.zoomAt(factor, cx, cy);
      }
      lastPinchDist = dist;
    }
  }, { passive: false });
  vp.addEventListener('touchend', () => { lastPinchDist = 0; }, { passive: true });

  // 画布按下 - 平移或双击新建
  vp.addEventListener('mousedown', (e) => {
    const isOnEmpty = !e.target.closest?.('.node, .node-toolbar, .context-menu');
    if (!isOnEmpty) return;

    if (pendingNodeCreation && e.button === 0) {
      closeNodePicker();
      return;
    }
    if (linkDrag?.persistent && e.button === 0) {
      const drag = linkDrag;
      const point = getCanvasWorldPoint(e.clientX, e.clientY);
      clearLinkDrag();
      openNodePicker(drag.sourceId, point.x, point.y, e.clientX, e.clientY);
      return;
    }

    if (spaceHeld || e.button === 1) {
      panning = true;
      spacePanned = true;
      panStart = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y };
      vp.classList.add('panning');
      e.preventDefault();
    } else if (e.button === 0) {
      // 左键空白处也可平移
      panning = true;
      panStart = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y };
      vp.classList.add('panning');
    }
    deselectAll();
  });

  // 鼠标移动
  let dragRafId = null;
  let lastMouse = { x: 0, y: 0 };
  const cancelDragFrame = () => {
    if (!dragRafId) return;
    cancelAnimationFrame(dragRafId);
    dragRafId = null;
  };

  const finishTouchGesture = (cancelDrag = false) => {
    cancelDragFrame();
    if (draggingNode) {
      draggingElement?.classList.remove('dragging');
      const snapshot = dragStartSnapshot;
      draggingNode = null;
      draggingElement = null;
      pendingNodeDrag = null;
      dragStartSnapshot = null;
      if (cancelDrag) restoreSnapshot(snapshot);
      else finishMapChange('移动节点', snapshot);
    } else {
      const shouldToggleSelection = !cancelDrag && pendingNodeDrag?.toggleSelection;
      pendingNodeDrag = null;
      dragStartSnapshot = null;
      if (shouldToggleSelection) deselectAll();
    }
    if (panning) {
      panning = false;
      vp.classList.remove('panning');
    }
  };

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) {
      if (linkDrag) finishLinkDrag(0, 0, true);
      else finishTouchGesture(true);
      return;
    }
    if (linkDrag) {
      e.preventDefault();
      updateLinkDrag(e.touches[0].clientX, e.touches[0].clientY);
      return;
    }
    if (!draggingNode && !pendingNodeDrag && !panning) return;

    e.preventDefault();
    const touch = e.touches[0];
    if (!draggingNode && pendingNodeDrag) {
      const dx = touch.clientX - pendingNodeDrag.startX;
      const dy = touch.clientY - pendingNodeDrag.startY;
      if (Math.hypot(dx, dy) >= 5) {
        draggingNode = pendingNodeDrag.node;
        draggingElement = pendingNodeDrag.el;
        draggingElement.classList.add('dragging');
        pendingNodeDrag = null;
      }
    }
    if (draggingNode) {
      lastMouse.x = touch.clientX;
      lastMouse.y = touch.clientY;
      if (dragRafId) return;
      dragRafId = requestAnimationFrame(() => {
        dragRafId = null;
        const rect = getCanvasRect();
        const wx = (lastMouse.x - rect.left - viewport.x) / viewport.scale;
        const wy = (lastMouse.y - rect.top - viewport.y) / viewport.scale;
        draggingNode.x = wx - dragOffset.x;
        draggingNode.y = wy - dragOffset.y;
        updateDragVisuals(draggingNode);
        saveStateThrottled();
      });
    } else if (panning) {
      viewport.x = panStart.vx + (touch.clientX - panStart.x);
      viewport.y = panStart.vy + (touch.clientY - panStart.y);
      viewport.apply();
      scheduleMinimapRender();
    }
  }, { passive: false });

  window.addEventListener('touchend', (e) => {
    if (linkDrag && e.touches.length === 0) {
      const touch = e.changedTouches?.[0];
      finishLinkDrag(touch?.clientX || linkDrag.currentX, touch?.clientY || linkDrag.currentY);
    } else if (e.touches.length === 0) {
      finishTouchGesture(false);
    }
  }, { passive: true });
  window.addEventListener('touchcancel', () => {
    if (linkDrag) finishLinkDrag(0, 0, true);
    else finishTouchGesture(true);
  }, { passive: true });

  window.addEventListener('mousemove', (e) => {
    if (linkDrag) {
      updateLinkDrag(e.clientX, e.clientY);
      return;
    }
    if (!draggingNode && pendingNodeDrag) {
      const dx = e.clientX - pendingNodeDrag.startX;
      const dy = e.clientY - pendingNodeDrag.startY;
      if (Math.hypot(dx, dy) >= 5) {
        draggingNode = pendingNodeDrag.node;
        draggingElement = pendingNodeDrag.el;
        draggingElement.classList.add('dragging');
        pendingNodeDrag = null;
      }
    }
    if (draggingNode) {
      lastMouse.x = e.clientX;
      lastMouse.y = e.clientY;
      // rAF 节流：每帧只更新一次位置，避免快速拖拽时冗余重绘
      if (dragRafId) return;
      dragRafId = requestAnimationFrame(() => {
        dragRafId = null;
        const rect = getCanvasRect();
        const wx = (lastMouse.x - rect.left - viewport.x) / viewport.scale;
        const wy = (lastMouse.y - rect.top - viewport.y) / viewport.scale;
        draggingNode.x = wx - dragOffset.x;
        draggingNode.y = wy - dragOffset.y;
        updateDragVisuals(draggingNode);
        saveStateThrottled();
      });
    } else if (crossDrag) {
      crossDrag.currentX = e.clientX;
      crossDrag.currentY = e.clientY;
      const hint = $('#drag-hint');
      hint.classList.remove('hidden');
      setCrossDragHint();
      hint.style.left = e.clientX + 'px';
      hint.style.top = e.clientY + 'px';
      // 高亮悬停的节点
      const targetEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.node');
      $$('.node.hover-target').forEach((n) => n.classList.remove('hover-target'));
      if (targetEl) targetEl.classList.add('hover-target');
    } else if (panning) {
      viewport.x = panStart.vx + (e.clientX - panStart.x);
      viewport.y = panStart.vy + (e.clientY - panStart.y);
      viewport.apply();
      renderMinimap();
    }
  });

  // 鼠标松开
  window.addEventListener('mouseup', (e) => {
    if (linkDrag) {
      finishLinkDrag(e.clientX, e.clientY);
      return;
    }
    cancelDragFrame();
    if (draggingNode) {
      draggingElement?.classList.remove('dragging');
      // 还原 z-index
      document.querySelectorAll(
        `.connection[data-from="${draggingNode.id}"], .connection[data-to="${draggingNode.id}"]`
      ).forEach((c) => { c.style.zIndex = ''; });
      finishMapChange('移动节点', dragStartSnapshot);
      draggingNode = null;
      draggingElement = null;
      dragStartSnapshot = null;
    } else if (pendingNodeDrag) {
      const shouldToggleSelection = pendingNodeDrag.toggleSelection;
      pendingNodeDrag = null;
      dragStartSnapshot = null;
      if (shouldToggleSelection) deselectAll();
    }
    if (panning) {
      panning = false;
      vp.classList.remove('panning');
    }
    if (crossDrag) {
      const drag = crossDrag;
      const targetEl = document.elementFromPoint(drag.currentX, drag.currentY)?.closest('.node');
      if (targetEl && targetEl.dataset.id !== crossDrag.sourceId) {
        reparent(drag.sourceId, targetEl.dataset.id);
      }
      crossDrag = null;
      $('#drag-hint').classList.add('hidden');
      $$('.node.hover-target').forEach((n) => n.classList.remove('hover-target'));
    }
  });

  // 双击空白处 - 创建根的子节点
  vp.addEventListener('dblclick', (e) => {
    const isOnEmpty = !e.target.closest?.('.node, .node-toolbar, .context-menu');
    if (!isOnEmpty) return;
    const rect = getCanvasRect();
    const wx = (e.clientX - rect.left - viewport.x) / viewport.scale;
    const wy = (e.clientY - rect.top - viewport.y) / viewport.scale;
    addChildNode(mindmap.root.id, '新节点', { x: wx, y: wy, radius: 0 }, '空白处新建节点');
  });

  // 节点事件代理
  const nodesEl = $('#nodes');
  const connectionsEl = $('#connections');

  // Coze/FlowGram 风格：连线自身也是可选中的对象，选中后按 Delete 删除。
  connectionsEl.addEventListener('mousedown', (e) => {
    const path = e.target.closest?.('.connection.free');
    if (!path) return;
    e.preventDefault();
    e.stopPropagation();
    selectedId = null;
    selectedLinkId = path.dataset.linkId || null;
    renderSelectionOnly();
  });

  nodesEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (pendingNodeCreation) {
      closeNodePicker();
      return;
    }
    if (linkDrag?.persistent) {
      const targetNode = e.target.closest('.node');
      if (targetNode) {
        if (targetNode.dataset.id === linkDrag.sourceId) {
          finishLinkDrag(e.clientX, e.clientY, true);
        } else {
          finishLinkDrag(e.clientX, e.clientY);
        }
      }
      return;
    }
    const portEl = e.target.closest('.node-port');
    if (portEl) {
      if (portEl.classList.contains('node-port-output')) {
        startLinkDrag(e, portEl.dataset.nodeId);
      } else {
        selectedId = portEl.dataset.nodeId;
        selectedLinkId = null;
        renderSelectionOnly();
      }
      return;
    }
    const nodeEl = e.target.closest('.node');
    if (!nodeEl || editing) return;
    e.stopPropagation();
    const id = nodeEl.dataset.id;
    const node = mindmap.nodes.get(id);
    if (!node) return;

    if (e.shiftKey) {
      // Shift 调整层级；工作流连线从节点输出端口拖到输入端口。
      crossDrag = {
        sourceId: id,
        currentX: e.clientX,
        currentY: e.clientY,
      };
      selectedId = id;
      selectedLinkId = null;
      renderSelectionOnly();
      setCrossDragHint();
      return;
    }

    const toggleSelection = selectedId === id;
    selectedLinkId = null;
    if (!toggleSelection) selectedId = id;
    const rect = getCanvasRect();
    const wx = (e.clientX - rect.left - viewport.x) / viewport.scale;
    const wy = (e.clientY - rect.top - viewport.y) / viewport.scale;
    dragOffset.x = wx - node.x;
    dragOffset.y = wy - node.y;
    pendingNodeDrag = {
      node,
      el: nodeEl,
      startX: e.clientX,
      startY: e.clientY,
      toggleSelection,
    };
    dragStartSnapshot = captureSnapshot();
    // 同步选中样式
    $$('.node.selected').forEach((n) => { if (n !== nodeEl) n.classList.remove('selected'); });
    nodeEl.classList.add('selected');
    renderConnections();
    updateNodeToolbar();
  });

  nodesEl.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || editing) return;
    if (pendingNodeCreation) {
      closeNodePicker();
      return;
    }
    if (linkDrag?.persistent) {
      const targetNode = e.target.closest('.node');
      if (targetNode) {
        const touch = e.touches[0];
        if (targetNode.dataset.id === linkDrag.sourceId) {
          finishLinkDrag(touch.clientX, touch.clientY, true);
        } else {
          finishLinkDrag(touch.clientX, touch.clientY);
        }
      }
      return;
    }
    const portEl = e.target.closest('.node-port');
    if (portEl) {
      if (portEl.classList.contains('node-port-output')) {
        startLinkDrag(e, portEl.dataset.nodeId);
      } else {
        selectedId = portEl.dataset.nodeId;
        selectedLinkId = null;
        renderSelectionOnly();
      }
      return;
    }
    const nodeEl = e.target.closest('.node');
    if (!nodeEl || e.target.closest?.('.node-add-child')) return;
    const node = mindmap.nodes.get(nodeEl.dataset.id);
    if (!node) return;
    e.stopPropagation();
    const touch = e.touches[0];
    const toggleSelection = selectedId === node.id;
    selectedLinkId = null;
    if (!toggleSelection) selectedId = node.id;
    const rect = getCanvasRect();
    const wx = (touch.clientX - rect.left - viewport.x) / viewport.scale;
    const wy = (touch.clientY - rect.top - viewport.y) / viewport.scale;
    dragOffset.x = wx - node.x;
    dragOffset.y = wy - node.y;
    pendingNodeDrag = {
      node,
      el: nodeEl,
      startX: touch.clientX,
      startY: touch.clientY,
      toggleSelection,
    };
    dragStartSnapshot = captureSnapshot();
    $$('.node.selected').forEach((n) => { if (n !== nodeEl) n.classList.remove('selected'); });
    nodeEl.classList.add('selected');
    renderConnections();
    updateNodeToolbar();
  }, { passive: false });

  nodesEl.addEventListener('dblclick', (e) => {
    const nodeEl = e.target.closest('.node');
    if (!nodeEl) return;
    e.stopPropagation();
    editNode(nodeEl.dataset.id);
  });

  nodesEl.addEventListener('contextmenu', (e) => {
    const nodeEl = e.target.closest('.node');
    if (!nodeEl) return;
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, nodeEl.dataset.id);
  });

  // 键盘
  window.addEventListener('keydown', (e) => {
    if (editing) {
      // 编辑中：Esc / Enter 由编辑框处理
      return;
    }
    if (isEditableTarget(e.target)) return;

    if (linkDrag && e.key === 'Escape') {
      e.preventDefault();
      finishLinkDrag(linkDrag.currentX, linkDrag.currentY, true);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      redo();
      return;
    }

    // 适配视图不依赖选中节点；带修饰键时让给浏览器（如 Ctrl+F 查找）。
    if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      viewport.fitToContent(mindmap);
      return;
    }

    if (selectedLinkId && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      removeSelectedLink();
      return;
    }

    if (e.code === 'Space' && !isEditableTarget(document.activeElement)) {
      e.preventDefault();
      if (!spaceHeld) {
        spaceHeld = true;
        spacePanned = false;
        vp.classList.add('space-held');
      }
    }

    if (selectedId && !editing) {
      const node = mindmap.nodes.get(selectedId);
      if (!node) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          handleToolAction('add-parent', selectedId);
        } else {
          addChildNode(selectedId);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        addSiblingNode(selectedId);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        handleToolAction('duplicate', selectedId);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId !== mindmap.root.id) {
          e.preventDefault();
          handleToolAction('delete', selectedId);
        }
      } else if (e.key === 'F2') {
        e.preventDefault();
        editNode(selectedId);
      }
    }

    if (e.key === 'Escape') {
      if (pendingNodeCreation) {
        closeNodePicker();
      } else if (draggingNode) {
        // 取消拖拽：恢复到按下节点前的快照
        cancelDragFrame();
        draggingElement?.classList.remove('dragging');
        document.querySelectorAll(
          `.connection[data-from="${draggingNode.id}"], .connection[data-to="${draggingNode.id}"]`
        ).forEach((c) => { c.style.zIndex = ''; });
        pendingNodeDrag = null;
        draggingNode = null;
        draggingElement = null;
        const snapshot = dragStartSnapshot;
        dragStartSnapshot = null;
        restoreSnapshot(snapshot);
      } else if (pendingNodeDrag) {
        pendingNodeDrag = null;
        dragStartSnapshot = null;
      } else {
        deselectAll();
        hideContextMenu();
        $('#modal')?.classList.add('hidden');
        $('#welcome')?.remove();
      }
      return;
    }

    // Ctrl/Cmd + B 切换侧栏
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      const sidebar = $('#sidebar');
      if (sidebar) sidebar.style.display = sidebar.style.display === 'none' ? '' : 'none';
      return;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code !== 'Space') return;
    const panned = spacePanned;
    spaceHeld = false;
    spacePanned = false;
    vp.classList.remove('space-held');
    // Space 兼作折叠快捷键和平移修饰键：只有没真的平移过才当成折叠，
    // 否则每次 Space+拖拽都会先把选中节点折叠掉。
    if (!panned && !editing && selectedId && !isEditableTarget(e.target)) {
      handleToolAction('collapse', selectedId);
    }
  });

  // 点击空白处关闭右键菜单
  window.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu')) {
      hideContextMenu();
    }
  });

  // 窗口大小
  window.addEventListener('resize', () => {
    viewport.apply();
    renderMinimap();
  });
}

/* ============== 重新挂载父节点 ============== */
function reparent(childId, newParentId) {
  if (childId === newParentId) return;
  if (childId === mindmap.root.id) return;
  const child = mindmap.nodes.get(childId);
  const newParent = mindmap.nodes.get(newParentId);
  if (!child || !newParent) return;
  const oldParent = mindmap.findParent(child);
  if (oldParent === newParent) return;

  // 不能挂到自己的后代上
  let p = newParent;
  while (p && p !== mindmap.root) {
    if (p === child) return;
    p = mindmap.findParent(p);
  }

  // 层级边也属于同一张 DAG；若已有反向路径，挂载后会形成循环。
  if (mindmap.hasPath(childId, newParentId)) {
    showToast('无法调整节点层级：会形成循环');
    return;
  }

  const before = captureSnapshot();

  // 从原父节点移除
  if (oldParent) {
    const idx = oldParent.children.indexOf(child);
    if (idx >= 0) oldParent.children.splice(idx, 1);
  }

  // 添加到新父
  newParent.children.push(child);
  // 目标节点与当前节点若已有自由连线，改成树边后删除冗余副本，
  // 避免同一对节点出现两条重叠连线。
  mindmap.links = mindmap.links.filter((link) => (
    !(link.from === newParent.id && link.to === child.id)
  ));

  // 重新定位到新父节点右侧，避免每次关联后位置随机跳动
  newParent.collapsed = false;
  const nextPosition = defaultChildPosition(newParent);
  child.x = nextPosition.x;
  child.y = nextPosition.y;

  finishMapChange('调整节点层级', before);
  showToast('已建立关联');
}

/* ============== 选中 ============== */
function deselectAll() {
  selectedId = null;
  selectedLinkId = null;
  $$('.node.selected').forEach((n) => n.classList.remove('selected'));
  $$('.node.link-drawing').forEach((n) => n.classList.remove('link-drawing'));
  $$('.connection.highlighted').forEach((c) => c.classList.remove('highlighted'));
  updateNodeToolbar();
}

/* ============== 编辑 ============== */
let pendingEditTimer = null;
let pendingEditId = null;
let editingSnapshot = null;
// renderNodes 在重建前会调用此函数强制结束编辑，否则 contenteditable 被
// 从 DOM 移除时不会触发 blur，`editing` 标志会卡在 true，所有快捷键失效。
let activeEditCommit = null;

function scheduleEdit(id, delay = 0) {
  // 取消上一个未触发的编辑请求（连点新建时会触发）
  if (pendingEditTimer) {
    clearTimeout(pendingEditTimer);
    pendingEditId = null;
  }
  pendingEditId = id;
  // 使用双 rAF 确保 DOM 完全提交后再获取节点
  const run = () => {
    pendingEditTimer = null;
    pendingEditId = null;
    editNode(id);
  };
  if (delay === 0) {
    requestAnimationFrame(() => requestAnimationFrame(run));
  } else {
    pendingEditTimer = setTimeout(run, delay);
  }
}

function editNode(id) {
  const node = mindmap.nodes.get(id);
  if (!node) return;
  const el = $(`.node[data-id="${id}"]`);
  if (!el) return;
  const textEl = $('.node-text', el) || el;

  // 如果已在编辑，先结束旧的
  const prev = $('.node.editing');
  if (prev && prev !== el) {
    prev.querySelector('.node-text')?.blur();
    prev.classList.remove('editing');
  }

  editingSnapshot = captureSnapshot();
  editing = true;
  textEl.contentEditable = 'true';
  el.classList.add('editing');

  // 强制焦点转移：先 blur 当前焦点元素，再 focus 新节点
  if (document.activeElement && document.activeElement !== el) {
    try { document.activeElement.blur(); } catch (e) {}
  }
  textEl.focus({ preventScroll: true });

  // 若 focus 失败，重试一次
  if (document.activeElement !== textEl) {
    requestAnimationFrame(() => textEl.focus({ preventScroll: true }));
  }

  // 全选文本，方便直接覆盖输入
  const range = document.createRange();
  range.selectNodeContents(textEl);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const finish = (commit) => {
    if (!editing) return;
    activeEditCommit = null;
    editing = false;
    textEl.contentEditable = 'false';
    el.classList.remove('editing');
    const before = editingSnapshot;
    editingSnapshot = null;
    if (commit) {
      const t = textEl.textContent.replace(/\s+/g, ' ').trim();
      node.text = t || '双击编辑';
    } else {
      textEl.textContent = node.text || '双击编辑';
    }
    textEl.removeEventListener('blur', onBlur);
    textEl.removeEventListener('keydown', onKey);
    if (commit) {
      finishMapChange('编辑节点', before);
    } else {
      render();
    }
  };

  // 暴露给 renderNodes：若 render 在用户改字过程中触发，强制把当前文本落盘，
  // 避免 contenteditable 被 detach 后 `editing` 卡死。
  activeEditCommit = () => {
    if (editing && el.isConnected) {
      // 用户在焦点丢失前先主动改字了，直接当成 blur 处理
      const t = textEl.textContent.replace(/\s+/g, ' ').trim();
      const newText = t || '双击编辑';
      if (newText !== (node.text || '双击编辑')) {
        finish(true);
        return;
      }
    }
    finish(false);
  };

  const onBlur = () => finish(true);
  const onKey = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      textEl.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
      textEl.blur();
    }
  };
  textEl.addEventListener('blur', onBlur);
  textEl.addEventListener('keydown', onKey);
}

/* ============== 右键菜单 ============== */
function showContextMenu(x, y, id) {
  selectedId = id;
  render();
  const menu = $('#context-menu');
  menu.classList.remove('hidden');
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  $$('.ctx-item').forEach((item) => {
    item.onclick = () => {
      handleContextAction(item.dataset.action, id);
      hideContextMenu();
    };
  });

  // 防止溢出
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';
  });
}

function hideContextMenu() {
  $('#context-menu').classList.add('hidden');
}

function handleContextAction(action, id) {
  const node = mindmap.nodes.get(id);
  if (!node) return;
  if (action === 'edit') editNode(id);
  else handleToolAction(action, id);
}

/* ============== 存储 ============== */
const STORAGE_KEY = 'mindmap-studio-v2';
const LEGACY_STORAGE_KEY = 'mindmap-studio-v1';
const LAYOUT_VERSION = 2;
const MARKDOWN_FORMAT_VERSION = 2;
let saveTimer = null;
let layoutNeedsMigration = false;
let markdownNeedsMigration = false;

function saveState() {
  try {
    const editor = $('#markdown-editor');
    if (editor) markdownText = editor.value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      layoutVersion: LAYOUT_VERSION,
      markdownFormatVersion: MARKDOWN_FORMAT_VERSION,
      root: mindmap.root,
      links: mindmap.links,
      markdownText,
      markdownLastValidText,
      mode: activeMode,
      viewport: { x: viewport.x, y: viewport.y, scale: viewport.scale },
      theme: document.documentElement.getAttribute('data-theme') || 'light',
    }));
  } catch (e) { /* ignore quota */ }
}

function saveStateThrottled() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 300);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data.root) return false;
    const m = MindMap.fromJSON(data.root, data.links);
    if (!m) return false;
    mindmap = m;
    layoutNeedsMigration = data.layoutVersion !== LAYOUT_VERSION;
    markdownNeedsMigration = data.markdownFormatVersion !== MARKDOWN_FORMAT_VERSION;
    if (data.viewport) {
      viewport.x = Number.isFinite(data.viewport.x) ? data.viewport.x : viewport.x;
      viewport.y = Number.isFinite(data.viewport.y) ? data.viewport.y : viewport.y;
      viewport.scale = clamp(Number(data.viewport.scale) || 1, viewport.minScale, viewport.maxScale);
    }
    if (data.theme) document.documentElement.setAttribute('data-theme', data.theme);
    if (['map', 'markdown', 'split'].includes(data.mode)) activeMode = data.mode;
    const generated = mindmap.toMarkdown();
    markdownText = typeof data.markdownText === 'string' ? data.markdownText : generated;
    markdownLastValidText = typeof data.markdownLastValidText === 'string'
      ? data.markdownLastValidText
      : generated;
    return true;
  } catch (e) {
    return false;
  }
}

/* ============== Toast ============== */
let toastTimer = null;
function showToast(msg, type = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.dataset.type = type;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('hidden');
    el.dataset.type = '';
  }, 1800);
}

/* ============== 工具栏 ============== */
function setupToolbar() {
  $('#btn-add-root').addEventListener('click', () => {
    addChildNode(mindmap.root.id);
  });
  $('#btn-auto-layout').addEventListener('click', () => {
    commitActiveEdit();
    const before = captureSnapshot();
    autoLayout(mindmap.root);
    finishMapChange('整理布局', before);
    viewport.fitToContent(mindmap);
    showToast('已整理布局');
  });

  $('#btn-import').addEventListener('click', () => {
    $('#welcome')?.remove();
    setActiveMode('markdown');
    $('#markdown-editor')?.focus();
  });

  $$('.mode-btn').forEach((button) => {
    button.addEventListener('click', () => setActiveMode(button.dataset.mode));
  });

  $('#btn-undo').addEventListener('click', undo);
  $('#btn-redo').addEventListener('click', redo);
  $('#md-open-file').addEventListener('click', () => $('#md-file-input').click());
  $('#md-export-file').addEventListener('click', () => exportMarkdown());
  $('#md-file-input').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) openMarkdownFile(file);
    e.target.value = '';
  });
  $('#btn-open-json').addEventListener('click', () => $('#json-file-input').click());
  $('#json-file-input').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) openJsonFile(file);
    e.target.value = '';
  });

  const editor = $('#markdown-editor');
  if (editor) {
    editor.addEventListener('input', () => {
      markdownText = editor.value;
      updateMarkdownGutter();
      setMarkdownStatus('输入中…', 'pending');
      clearTimeout(markdownParseTimer);
      markdownParseTimer = setTimeout(() => applyMarkdownDraft({
        label: '编辑 Markdown',
        coalesce: true,
      }), 300);
    });
    editor.addEventListener('click', selectNodeFromMarkdownCursor);
    editor.addEventListener('keyup', selectNodeFromMarkdownCursor);
    editor.addEventListener('select', selectNodeFromMarkdownCursor);
    editor.addEventListener('scroll', () => {
      const gutter = $('#md-gutter');
      if (gutter) gutter.scrollTop = editor.scrollTop;
    });
    editor.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(markdownParseTimer);
        applyMarkdownDraft({ label: '编辑 Markdown', coalesce: true });
      }
    });
  }

  $('#md-gutter').addEventListener('click', (e) => {
    const editorEl = $('#markdown-editor');
    if (!editorEl) return;
    const lineHeight = parseFloat(getComputedStyle(editorEl).lineHeight) || 22;
    const line = Math.max(0, Math.floor(
      (e.clientY - e.currentTarget.getBoundingClientRect().top + editorEl.scrollTop) / lineHeight
    ));
    const id = markdownLineNodes.get(line);
    if (!id) return;
    selectedId = id;
    renderSelectionOnly();
    focusMarkdownNode(id, false);
  });

  $('#btn-export-md').addEventListener('click', () => {
    exportMarkdown();
  });

  $('#btn-export-json').addEventListener('click', () => {
    const data = {
      version: 2,
      markdownFormatVersion: MARKDOWN_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      root: mindmap.root,
      links: mindmap.links,
      markdownText: $('#markdown-editor')?.value || markdownText,
    };
    download('mindmap.json', JSON.stringify(data, null, 2), 'application/json');
    showToast('已导出 JSON');
  });

  $('#btn-clear').addEventListener('click', () => {
    commitActiveEdit();
    if (mindmap.count() === 1 && !mindmap.root.children.length) {
      showToast('当前已经是空白脑图');
      return;
    }
    if (!confirm('清空后可以使用撤销恢复，确定继续吗？')) return;
    const before = captureSnapshot();
    mindmap = new MindMap();
    selectedId = null;
    finishMapChange('清空脑图', before);
    viewport.fitToContent(mindmap);
    showToast('已清空，可使用撤销恢复');
    showWelcome();
  });

  $('#btn-theme').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    saveState();
  });

  $('#fab-fit').addEventListener('click', () => {
    viewport.fitToContent(mindmap);
    showToast('已调整到可读视图');
  });
  $('#zoom-in').addEventListener('click', () => {
    const rect = getCanvasRect();
    viewport.zoomAt(1.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  $('#zoom-out').addEventListener('click', () => {
    const rect = getCanvasRect();
    viewport.zoomAt(1 / 1.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  $('#zoom-reset').addEventListener('click', () => {
    viewport.reset();
  });
}

function exportMarkdown() {
  const content = $('#markdown-editor')?.value || markdownText || mindmap.toMarkdown();
  download('mindmap.md', content, 'text/markdown;charset=utf-8');
  showToast('已导出 Markdown');
}

function hasDocumentContent() {
  const editorText = $('#markdown-editor')?.value.trim();
  return mindmap.count() > 1
    || normalizedNodeText(mindmap.root.text) !== '中心主题'
    || Boolean(editorText && editorText !== '# 中心主题');
}

function confirmDocumentReplacement(action) {
  if (!hasDocumentContent()) return true;
  return confirm(`${action}会替换当前脑图，确定继续吗？`);
}

function openMarkdownFile(file) {
  if (!confirmDocumentReplacement('打开 Markdown')) return;
  file.text().then((text) => {
    setActiveMode('split');
    const normalized = normalizeMarkdown(text);
    const result = parseMarkdown(normalized.text);
    if (!result.valid) {
      markdownText = text;
      clearMarkdownLineMaps();
      updateMarkdownEditorValue(text);
      renderMarkdownDiagnostics(parseMarkdown(text).diagnostics);
      $('#welcome')?.remove();
      saveState();
      showToast('Markdown 存在无法识别的内容');
      return;
    }
    applyMarkdownText(text, {
      forceLayout: true,
      preservePrevious: false,
      label: '打开 Markdown',
      coalesce: false,
    });
    viewport.fitToContent(mindmap);
    showToast('已打开 Markdown');
  }).catch(() => showToast('Markdown 文件读取失败'));
}

function openJsonFile(file) {
  if (!confirmDocumentReplacement('打开 JSON')) return;
  file.text().then((text) => {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      showToast('JSON 文件格式错误');
      return;
    }
    const root = data.root || data;
    const nextMap = MindMap.fromJSON(root, data.links);
    if (!nextMap) {
      showToast('JSON 中没有有效脑图');
      return;
    }
    commitActiveEdit();
    const before = captureSnapshot();
    mindmap = nextMap;
    selectedId = null;
    finishMapChange('打开 JSON', before);
    const savedMarkdown = typeof data.markdownText === 'string' ? data.markdownText : '';
    markdownNeedsMigration = Boolean(savedMarkdown.trim())
      && data.markdownFormatVersion !== MARKDOWN_FORMAT_VERSION;
    if (savedMarkdown.trim()) {
      restoreSavedMarkdownDraft(savedMarkdown);
      render();
      saveState();
    } else {
      markdownNeedsMigration = false;
    }
    viewport.fitToContent(mindmap);
    setActiveMode('map');
    showToast('已打开 JSON 备份');
  }).catch(() => showToast('JSON 文件读取失败'));
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============== 欢迎页 ============== */
function showWelcome() {
  if ($('#welcome')) return;
  const welcome = document.createElement('div');
  welcome.id = 'welcome';
  welcome.className = 'welcome';
  welcome.innerHTML = `
    <div class="welcome-card">
      <div class="welcome-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <circle cx="4" cy="6" r="2"/>
          <circle cx="4" cy="18" r="2"/>
          <circle cx="20" cy="6" r="2"/>
          <circle cx="20" cy="18" r="2"/>
          <path d="M12 12 L4 6 M12 12 L4 18 M12 12 L20 6 M12 12 L20 18"/>
        </svg>
      </div>
      <div class="welcome-title">脑图编辑器</div>
       <div class="welcome-sub">从一个主题开始，脑图和 Markdown 会保持同步。</div>
       <div class="welcome-actions">
         <button class="welcome-btn" data-action="import">编辑 Markdown</button>
         <button class="welcome-btn ghost" data-action="start">从空白开始</button>
      </div>
    </div>
  `;
  document.body.appendChild(welcome);

  welcome.querySelector('[data-action="import"]').addEventListener('click', () => {
    welcome.remove();
    setActiveMode('markdown');
    $('#markdown-editor')?.focus();
  });
  welcome.querySelector('[data-action="start"]').addEventListener('click', () => {
    welcome.remove();
    editNode(mindmap.root.id);
  });
}

/* ============== 启动 ============== */
export function init() {
  setupEvents();
  setupToolbar();

  const loaded = loadState();
  setActiveMode(activeMode, false);

  if (loaded) {
    const savedMarkdown = markdownText;
    syncMarkdownFromMap();
    restoreSavedMarkdownDraft(savedMarkdown);
    viewport.apply();
    render();
    if (!hasDocumentContent()) showWelcome();
  } else {
    // 首次打开保持真正的空白状态，示例内容不再强制载入。
    mindmap = new MindMap();
    syncMarkdownFromMap();
    viewport.fitToContent(mindmap);
    render();
    saveState();
    showWelcome();
  }

  // 周期自动保存（防止遗漏）
  setInterval(saveState, 10000);

  // 离开页面前保存
  window.addEventListener('beforeunload', saveState);
}
