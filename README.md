# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:


## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

# Grist 产品 BOM 部件

这个 React 应用可以作为 Grist 自定义部件，绑定生产计划表，读取当前选中行的产品和生产数量，再从产品 BOM 表展开最终物料清单。

## Grist 表格结构

生产计划表包含 `项目`、`需求`、`数量`。其中 `需求` 是产品的单项引用，`数量` 是本次生产数量。添加部件时，将组件绑定到生产计划表，并把「需求产品」映射到 `需求`，「生产数量」映射到 `数量`。

产品 BOM 表包含 `产品`、`原料`、`数量`。前两列是单项引用，最后一列是数值列。每一行表示一条直接物料关系：

在 Grist API 返回的数据中，这三列当前对应内部列 ID `A`、`B`、`C`，组件会优先读取这些内部 ID，再兼容中文字段名。

| Product | Component | Quantity |
| --- | --- | ---: |
| 产品 B | 模块 A | 2 |
| 模块 A | 螺丝 | 2 |

## 发布和配置

1. 执行 `pnpm build`，把 `dist` 部署到 GitHub Pages、Cloudflare Pages 等公开 HTTPS 地址。
2. 在 Grist 中添加「Custom」部件，把该部署地址填入 `Custom URL`。
3. 在部件的 Creator Panel 中选择生产计划表，授权 `Full document access`，并设置 `Select By` 为生产计划表自身，以便跟随当前选中行。
4. 将「需求产品」映射到生产计划的 `需求`，「生产数量」映射到生产计划的 `数量`。
5. 在 [src/grist.js](src/grist.js) 的 `BOM_TABLE_ID` 中填写产品 BOM 表的内部 ID。它不是页面上显示的标题，可通过 Grist API 的 `listTables()` 或开发者工具确认。当前产品 BOM 表的 ID 是 `BOM`，引用主表 ID 是 `IC_DATA`。

部件通过 `grist.ready` 请求完整文档访问权限，通过 `grist.onRecord` 跟随当前选中行，并用 `grist.docApi.fetchTable` 读取产品 BOM 表。未嵌入 Grist 时会使用内置演示数据，方便本地开发。
