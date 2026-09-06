# Product

<!-- impeccable:product-schema 1 -->

> 本记录根据当前 README.md、index.html、src/ 和 package.json 整理，未添加仓库之外的业务承诺。

## Platform

web

## Users

需要整理想法、维护脑图结构，并在脑图与 Markdown 之间切换的个人用户。

## Product Purpose

提供一个基于 Vite 的浏览器脑图编辑器，让用户通过节点编辑、拖拽和 Markdown 双向同步快速整理内容。

## Positioning

脑图结构、Markdown 文本、工作流连线和本地自动保存集中在同一个轻量前端工作区中。

## Operating Context

用户通过 Vite 开发服务器进入应用，在画布上编辑节点，也可以切换 Markdown 或分屏视图；内容默认保存到浏览器 localStorage。

## Capabilities and Constraints

- 支持节点增删改、拖拽、折叠、撤销重做、缩放平移、自动布局和大纲导航。
- 支持 Markdown 与 JSON 的导入导出，以及节点之间的有向工作流连线。
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

## Accessibility & Inclusion

保留键盘快捷键、按钮 aria-label、可见焦点样式和 reduced-motion 适配。
