# VaultBranch

[English](README.md) | [简体中文](README_zh.md)

在 Obsidian 中管理 Git。仅支持桌面端，需要安装 Git，并将笔记库初始化为 Git 仓库。

## 主要功能

- **Git 侧栏**：查看改动文件，按文件或文件夹暂存；提交、拉取和推送，首次推送可选择远程与上游。
- **可编辑差异**：左右对比版本，直接编辑、回退单个改动块；支持手动保存和可选自动保存。
- **图片对比**：在修改区、暂存区和文件历史中对比图片，支持缩放和拖动；SVG 默认预览，可切换源码。
- **提交图与文件历史**：查看分支、合并和历史修改，跟随文件重命名；提交图可拖动列宽、点击哈希复制，日期统一为 YYYY/MM/DD。
- **分支与 Stash**：创建或切换分支，收起未提交改动，支持指定 Stash 的 Apply、Pop 和确认后 Drop。
- **冲突处理**：原生双栏对照，本地侧直接编辑合并结果；逐块采用任一侧或双方、撤销选择及交换窗格顺序，确认后保存并暂存。
- **编辑辅助**：差异折叠与跳转、可选 JSON/Markdown 语法高亮、日期插入、中英文界面。
- **笔记表格兼容**：可选支持表格前无空行的阅读与实时预览，源码沿用原生表格样式。

## 安装

先安装 Git，在笔记库目录运行 `git init` 初始化仓库。提交身份与远程认证使用本机 Git 配置。

- **BRAT**：添加 `crli-idea/VaultBranch`，然后在「设置 → 第三方插件」启用 VaultBranch。
- **手动安装**：从[最新 Release](https://github.com/crli-idea/VaultBranch/releases/latest) 下载 `main.js`、`manifest.json`、`styles.css`，放入 `<笔记库>/.obsidian/plugins/vaultbranch/`，重新加载 Obsidian 后启用。

## 基本使用

在命令面板打开 VaultBranch 的源代码管理侧栏。点击未暂存文件查看差异并编辑，Ctrl/Cmd+S 保存；用 **+** 暂存文件或文件夹，填写提交信息后提交暂存内容。Pull/Push 与配置的远程同步，首次 Push 可选择远程和上游。打开 Git Graph 浏览提交，或右键文件查看文件历史。

## 权限说明

仅支持桌面端。插件使用 Node.js 文件接口访问仓库文件及 Git 元数据，linked worktree 的元数据可能位于笔记库之外。通过 `execFile`、参数数组及 `shell: false` 调用本机 Git；Git 钩子和凭据助手沿用本机配置。这些能力拥有 Obsidian 的系统权限。仅在点击复制时写入提交哈希或调优日志，不读取剪贴板。Release 附带 GitHub 来源证明，用于验证构建来源，不会消除上述能力提示。

## 当前性能 · 1.0.11

本地 Windows / Obsidian 1.15.1，与 1.0.10 对比。中位数，单位 ms；本次修复仓库迁移与审核问题，不宣称提速。

| 测试项目 | ms | 样本数 |
| --- | ---: | --- |
| 插件重载（缓存已预热） | 7.8 | 5 |
| 点击 → Staged / Changed 页面就绪 | 190.6 / 136.4 | 各 20 |
| Changed 1.6 MB JSON: 输入 / 换行 / 删除 | 5.1 / 4.2 / 1.1 | 各 5 |
| Changed 1.28 MB Markdown: 输入 / 换行 / 删除 | 4.6 / 5.1 / 6.4 | 各 5 |

表格兼容默认关闭。切换包含 CPU 采样；修改测量原生输入至文档更新。[环境、范围、对比及复现](https://github.com/crli-idea/VaultBranch/blob/1.0.11/docs/performance/1.0.11.md) · [Tag 1.0.11](https://github.com/crli-idea/VaultBranch/releases/tag/1.0.11)。

## 反馈与建议

欢迎 [提交 Issue](https://github.com/crli-idea/VaultBranch/issues/new/choose)，反馈问题或提出功能请求！
