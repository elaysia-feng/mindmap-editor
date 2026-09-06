# MindMap Studio Design System

## Direction contract

### THESIS

把脑图当作一张可操作的图谱工作台：画布承载空间关系，工具栏只承担编辑动作，拒绝泛滥的渐变、发光和玻璃模糊。

### OWN-WORLD

Blueprint Desk 使用冷雾灰绿画布、深墨色文字、信号青绿主色和琥珀状态色。面板是有边界的实体表面，节点以纸张色/墨色表面和层级色带表达结构。

### STORY

用户先看见中心主题和分支关系，再通过顶部动作、节点浮动工具栏或 Markdown 面板进行修改；选中、折叠、拖拽和连线都用稳定的高对比状态反馈。

### FIRST VIEWPORT

画布铺满首屏并使用点阵网格保持方向感；顶部左侧是产品身份，中部是历史与视图切换，右侧是编辑动作；右侧面板固定呈现缩略图、大纲和快捷键，底部保留状态信息。

### FORM

Operate 模式的图谱工作台，使用 Vue 3 + TypeScript + Vite 组织应用壳；组件负责稳定的界面结构，`src/editor/controller.ts` 保留画布高频交互，不改变业务行为。

### FINISH

unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Tokens

- 画布：浅色 `#eef3f1`，深色 `#0b1419`，点阵网格作为空间参照。
- 交互：浅色信号青绿 `#0b756e`，深色薄荷青 `#70d5c5`，琥珀色用于折叠和重点关系。
- 字体：优先 Inter 与系统中文字体栈；等宽字体仅用于 Markdown、快捷键和行号。
- 形状：面板 8–12px 圆角，节点 9px，根节点 14px；避免大面积胶囊化。

## Component language

- 顶部栏、侧边栏、Markdown 面板使用实体面板和 1px 边界，不使用装饰性 backdrop blur。
- 根节点使用深青色块，子节点使用内容表面加层级色带；选中状态使用单一高对比描边。
- 连线使用分层色阶，选中/自由连线切换为琥珀或主色，不使用持续霓虹滤镜。
- 空状态、弹窗、右键菜单和节点工具栏共享同一面板、边界和焦点语言。

## Responsive behavior

桌面保留右侧大纲与缩略图；窄屏隐藏侧栏、压缩顶部动作并让 Markdown 面板占满可用区域。所有操作仍保留键盘焦点与 reduced-motion 支持。
