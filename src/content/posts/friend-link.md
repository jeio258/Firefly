---
title: 博客部署
draft: false
description: 本次更新为博客引入了友链审核系统、全功能管理后台以及深度品牌定制，并清理了示例内容。以下是主要变更描述：
tags:
  - 教程，部署指南
category: 博客指南
image: https://t.alcy.cc/ycy
published: 2026-07-16T00:00:00.000Z
---


## 🚀 本地开发部署（从零开始）

### 环境要求
- Node.js >= 22
- pnpm >= 9

### 1. 克隆仓库

你可以直接克隆主仓库，但更推荐先 Fork 到自己名下再克隆：

```
bash
git clone https://github.com/jeio258/Firefly.git
cd Firefly
```

### 2. 安装依赖

```bash
npm install -g pnpm   # 如果尚未安装 pnpm
pnpm install
```

### 3. 创建 GitHub OAuth App（友链审核功能必需）

前往 [GitHub Developer Settings](https://github.com/settings/developers) 新建一个 OAuth App：
- **Application name**：任意填写，如 `My Blog Admin`  
- **Homepage URL**：你的博客首页地址  
- **Authorization callback URL**：`https://你的Worker域名/api/auth/callback`

创建完成后，你将获得 **Client ID** 和 **Client Secret**。  
接着生成一个具有 `repo` 权限的 **Personal Access Token**，用于向仓库推送友链数据。

### 4. 配置 Cloudflare 环境变量

登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)，进入你的 Worker 设置，添加以下加密环境变量：

| 变量名               | 说明                                                         |
| -------------------- | ------------------------------------------------------------ |
| `GITHUB_CLIENT_ID`   | 上一步获取的 OAuth App Client ID                            |
| `GITHUB_CLIENT_SECRET` | OAuth App Client Secret                                   |
| `GITHUB_TOKEN`       | 拥有 repo 权限的 Personal Access Token                      |
| `GITHUB_REPO`        | 仓库全名，例如 `CuteLeaf/Firefly`                           |
| `GITHUB_BRANCH`      | 要推送的分支，一般为 `main`                                  |

配置无误后，友链审核后台即可正常工作。

### 5. 自定义博客配置

所有可配置项都在 `src/config/` 目录下，推荐至少修改以下文件：
- `siteConfig.ts`：站点名称、语言、域名等基础信息
- `profileConfig.ts`：个人头像、昵称、社交链接
- `navBarConfig.ts`：导航菜单
- `sidebarConfig.ts`：侧边栏布局与小组件

更多细节见 [Firefly 使用文档](https://docs-firefly.cuteleaf.cn/)。

### 6. 启动开发服务器

```bash
pnpm dev
```

浏览器访问 `http://localhost:4321` 即可实时预览。

---

## 🧞 常用命令

| 命令                       | 说明                             |
| -------------------------- | -------------------------------- |
| `pnpm install`             | 安装依赖                         |
| `pnpm dev`                 | 启动开发服务器 (localhost:4321)  |
| `pnpm build`               | 构建生产版本至 `./dist/`         |
| `pnpm preview`             | 本地预览构建结果                 |
| `pnpm new-post <filename>` | 快速创建新文章                   |
| `pnpm format`              | 格式化代码                       |


现在，你可以轻松打造属于自己的个性博客了。如果在使用中遇到任何问题，欢迎到 [GitHub Issues](https://github.com/CuteLeaf/Firefly/issues) 反馈，或加入 QQ 交流群：**1087127207** 一起讨论。
```