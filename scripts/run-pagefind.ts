// 在 astro build 之后运行 Pagefind。
// 之前直接在 package.json 里写 `pagefind --site dist`，在 Cloudflare Pages（产物在
// dist/client）上会索引出 /client/... 的假路径，并且索引输出到 dist/pagefind，
// 根本不会随站点部署 —— 线上搜索一直是 404。这里对准真正的站点根目录再跑，
// 索引会输出到 <root>/pagefind，随站点一起上传。

import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { resolveSiteRoot } from "./site-root";

// 搜索页只加载 pagefind.js + worker，官方 UI 与高亮脚本从未被引用，随产物上传纯属浪费
const UNUSED_UI_FILES = [
	"pagefind-ui.js",
	"pagefind-ui.css",
	"pagefind-modular-ui.js",
	"pagefind-modular-ui.css",
	"pagefind-component-ui.js",
	"pagefind-component-ui.css",
	"pagefind-highlight.js",
];

const siteRoot = resolveSiteRoot();

const result = spawnSync("pagefind", ["--site", siteRoot], {
	stdio: "inherit",
	// Windows 下 .bin 里是 .cmd 包装，需要 shell 才能解析到
	shell: process.platform === "win32",
});

if (result.status !== 0) {
	process.exit(result.status ?? 1);
}

for (const file of UNUSED_UI_FILES) {
	await rm(path.join(siteRoot, "pagefind", file), { force: true });
}
