---
title: CloudFlare-ImgBed 图床 + Firefly 相册 部署教程
draft: false
description: CloudFlare-ImgBed 图床 + Firefly 相册 部署教程
tags:
  - 教程，部署指南
category: 博客指南
image: https://tc.alcy.cc/tc/20260121/cdf58dc918fb56bfd0dacf18ec944465.webp
published: 2026-07-25
comment: true
---
## 一、部署图床（CloudFlare-ImgBed / Sanyue ImgHub）

### 1.1 克隆项目

```bash
git clone https://github.com/MarSeventh/CloudFlare-ImgBed.git
cd CloudFlare-ImgBed
npm install
```

### 1.2 配置环境变量

复制 `.env.example` 为 `.env`，填写必要配置：

```env
# 必填：Telegram Bot Token（用于存储文件到 Telegram）
TG_BOT_TOKEN=你的Telegram Bot Token

# 必填：管理员密码
ADMIN_PASSWORD=你的管理员密码

# 可选：自定义域名
CUSTOM_DOMAIN=https://imge.yourdomain.com
```

### 1.3 部署到 Cloudflare Pages

```bash
# 构建
npm run build

# 部署（需要先安装 wrangler 并登录）
npx wrangler pages deploy dist --project-name=imge
```

或在 Cloudflare Dashboard 中：
1. Workers & Pages → Create → Pages → Connect to Git
2. 选择仓库，框架预设选 **None**
3. 构建命令：`npm run build`
4. 输出目录：`dist`
5. 添加环境变量（TG_BOT_TOKEN 等）

### 1.4 配置 Telegram 存储

1. 在 Telegram 搜索 `@BotFather`，创建 Bot 获取 Token
2. 创建一个频道，将 Bot 添加为管理员
3. 发送一条消息到频道，转发给 `@getidsbot` 获取频道 ID
4. 将 Token 和频道 ID 填入 `.env`

### 1.5 生成 API Token

1. 访问 `https://你的域名/admin` 登录管理后台
2. 系统设置 → 安全设置 → API Token 管理
3. 新建 Token，勾选 **list** 权限
4. 复制保存 Token（仅显示一次）

---

## 二、对接 Firefly 相册

### 2.1 配置文件

编辑 Firefly 项目的 `src/config/imgBedConfig.ts`：

```ts
export const imgBedConfig = {
	baseUrl: "https://你的图床域名",
	apiToken: "你的API Token（list权限）",
	pageSize: 50,
};
```

### 2.2 相册配置

在 `src/config/galleryConfig.ts` 的 `albums` 数组中已包含图床相册条目：

```ts
{
    id: "imgbed",
    name: "图床相册",
    description: "来自 ImgBed 的图片（构建时自动同步）",
    location: "CloudFlare-ImgBed",
    date: "2026-01-01",
    tags: ["图床", "自动同步"],
},
```

### 2.3 构建与发布

```bash
pnpm build    # 构建时自动从 API 拉取最新图片列表
pnpm preview  # 本地预览
```

构建后访问 `https://你的博客域名/gallery/imgbed` 即可看到图床中的所有图片。

---

## 三、工作原理

```
pnpm build
    │
    ├─ src/utils/imgbed-utils.ts
    │     └─ fetchImgBedImages()
    │           │
    │           ├─ GET /api/manage/list?fileType=image&start=0&count=50
    │           │  Authorization: Bearer <token>
    │           │
    │           └─ 循环分页拉取直到全部获取
    │
    ├─ src/utils/gallery-utils.ts
    │     └─ scanAlbumPhotos("imgbed")
    │           └─ 调用 fetchImgBedImages()
    │
    └─ 生成静态 HTML，图片 URL 硬编码为 /file/<name>
```

- 图片在**构建时**拉取，生成静态页面
- 新增图片后需要**重新构建**才会显示
- 支持分页，自动处理大量图片

---

## 四、常见问题

### Q: 图床使用哪种存储？

A: 支持 Telegram、Cloudflare R2、S3、Discord、HuggingFace。推荐 Telegram（免费无限存储）。

### Q: 图片不显示？

A: 检查 `imgBedConfig.ts` 中的 `baseUrl` 是否正确，API Token 是否有 `list` 权限。浏览器 F12 → Network 查看 API 请求是否 200。

### Q: 如何更新图片？

A: 在图床上传新图片后，重新执行 `pnpm build` 即可同步。

### Q: CORS 问题？

A: ImgBed 默认已启用 `Access-Control-Allow-Origin: *`，无需额外配置。
