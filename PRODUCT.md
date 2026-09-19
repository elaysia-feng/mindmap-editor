# Product

<!-- impeccable:product-schema 1 -->

> 本记录根据当前 README.md、index.html、src/ 和 package.json 整理，未添加仓库之外的业务承诺。

## Platform

web

## Users

需要整理想法、维护脑图结构，并在脑图与 Markdown 之间切换的个人用户。

## Product Purpose

提供一个本地优先的个人知识工作台，让用户以脑图为主、Markdown 为辅助，在多个文档之间持续记录、梳理和回看想法。

## Positioning

脑图负责空间思考，Markdown 负责批量编辑，本地文档库负责长期管理；工作流连线作为按需启用的高级关系能力。

## Operating Context

用户在桌面浏览器中进行主要编辑，也会在手机上浏览、搜索和快速补充内容。文档只保存在浏览器本地，默认继续上次编辑的文档，并可随时返回文档库。

## Capabilities and Constraints

- 支持节点增删改、拖拽、折叠、撤销重做、缩放平移、自动布局和大纲导航。
- 支持 Markdown 与 JSON 的导入导出，以及节点之间的有向工作流连线。
- 支持本地多文档、搜索、模板、复制和可恢复删除，不包含账号、云同步、文件夹或标签。
- 项目使用 Vue 3、TypeScript 和 Vite 组织前端代码，不依赖服务端。

## Evidence on Hand

- 产品入口：index.html
- 交互与数据模型：src/editor/controller.ts
- 视觉系统：src/styles/styles.css
- 功能说明：README.md

## Product Principles

- 结构变化应尽快反馈到另一种视图。
- 画布操作优先保证可读性和可恢复性。
- 本地优先，不把用户内容发送到外部服务。
- 默认界面保持安静，导航、Markdown 和高级关系在需要时再出现。

## Accessibility & Inclusion

保留键盘快捷键、按钮 aria-label、可见焦点样式和 reduced-motion 适配。
