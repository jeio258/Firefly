#!/usr/bin/env node
/**
 * 端到端 UI 冒烟测试（本项目无单元测试框架，用此脚本代替"跑测试"）
 *
 * 覆盖：页面渲染完整性、控制台错误、Swup 单程导航（含 popstate）、
 * 移动端视口横向溢出、破损图片、TOC 结构与 scrollspy。
 *
 * 用法：
 *   pnpm build && pnpm preview          # 先在另一个终端起 preview
 *   node scripts/verify-ui.mjs
 *
 *   node scripts/verify-ui.mjs --base http://localhost:4321 --chrome /path/to/chrome
 *
 * 环境变量：VERIFY_BASE / CHROME_PATH / CDP_PORT
 */

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const BASE =
	process.env.VERIFY_BASE || argValue("--base") || "http://localhost:4321";
const CDP_PORT = Number(process.env.CDP_PORT || argValue("--cdp-port") || 9222);
const CHROME = process.env.CHROME_PATH || argValue("--chrome") || findChrome();

function argValue(flag) {
	const i = process.argv.indexOf(flag);
	return i !== -1 ? process.argv[i + 1] : undefined;
}

function findChrome() {
	const home = process.env.HOME || "";
	const candidates = [];
	// Playwright 缓存目录带版本号，动态扫描而不是写死
	const pwRoot = join(home, ".cache", "ms-playwright");
	if (existsSync(pwRoot)) {
		for (const dir of readdirSync(pwRoot)) {
			if (!dir.startsWith("chromium-")) continue;
			candidates.push(
				join(pwRoot, dir, "chrome-linux64", "chrome"),
				join(pwRoot, dir, "chrome-linux", "chrome"),
				join(
					pwRoot,
					dir,
					"chrome-mac",
					"Chromium.app",
					"Contents",
					"MacOS",
					"Chromium",
				),
			);
		}
	}
	candidates.push(
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
		"/usr/bin/google-chrome",
		"/usr/bin/google-chrome-stable",
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	);
	return candidates.find((p) => existsSync(p));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
let msgId = 0;
const pending = new Map();
const consoleErrors = [];
const failures = [];
let checks = 0;

function send(method, params = {}) {
	const id = ++msgId;
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve, reject });
		ws.send(JSON.stringify({ id, method, params }));
		setTimeout(() => {
			if (pending.has(id)) {
				pending.delete(id);
				reject(new Error(`CDP timeout: ${method}`));
			}
		}, 30000);
	});
}

async function evaluate(expression) {
	const r = await send("Runtime.evaluate", {
		expression,
		returnByValue: true,
		awaitPromise: true,
	});
	if (r.exceptionDetails) {
		throw new Error(
			r.exceptionDetails.exception?.description || r.exceptionDetails.text,
		);
	}
	return r.result.value;
}

function check(name, ok, detail = "") {
	checks += 1;
	if (ok) {
		console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
	} else {
		failures.push(name);
		console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
	}
}

async function connect() {
	const list = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`).then((r) =>
		r.json(),
	);
	const page = list.find((t) => t.type === "page");
	if (!page) throw new Error("未找到 Chromium page target");
	ws = new WebSocket(page.webSocketDebuggerUrl);
	await new Promise((res, rej) => {
		ws.onopen = res;
		ws.onerror = rej;
	});
	ws.onmessage = (e) => {
		const m = JSON.parse(e.data);
		if (m.id && pending.has(m.id)) {
			const { resolve, reject } = pending.get(m.id);
			pending.delete(m.id);
			m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
			return;
		}
		if (m.method === "Runtime.exceptionThrown") {
			consoleErrors.push(
				"[uncaught] " +
					(
						m.params.exceptionDetails.exception?.description ||
						m.params.exceptionDetails.text
					).slice(0, 200),
			);
		}
		if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
			consoleErrors.push(
				"[console.error] " +
					m.params.args
						.map((a) => a.value ?? a.description ?? "")
						.join(" ")
						.slice(0, 200),
			);
		}
		if (m.method === "Log.entryAdded" && m.params.entry.level === "error") {
			const t = m.params.entry.text || "";
			if (/favicon/i.test(t)) return;
			// 外部资源（友链头像/分析 SDK/CDN）加载失败属环境抖动，非本站回归；同源资源失败仍计
			const urlMatch = t.match(/(https?:\/\/[^\s)]+)/);
			if (
				urlMatch &&
				new URL(urlMatch[1], BASE).origin !== new URL(BASE).origin
			) {
				return;
			}
			consoleErrors.push(`[log] ${t.slice(0, 200)}`);
		}
	};
	await send("Page.enable");
	await send("Runtime.enable");
	await send("Log.enable");
}

const PROBE = `(async () => {
  const de = document.documentElement;
  // 等待图片加载收敛（最多 3s），避免慢加载被误判；对已失败图片重试一次再判定，
  // 过滤外部图床（如友链头像）的瞬时网络抖动
  const settle = (img) => new Promise((r) => {
    if (img.complete) return r();
    img.addEventListener('load', r, { once: true });
    img.addEventListener('error', r, { once: true });
    setTimeout(r, 3000);
  });
  // 仅统计有真实 src 的图片：空 src 占位图（如无封面时的播放器封面）渲染为空、
  // 会被浏览器解析为页面 URL 而报失败，属既有视觉占位而非资源回归
  const isRealSrc = (i) => {
    const s = i.getAttribute('src');
    return !!s && s.trim() !== '';
  };
  await Promise.all([...document.images].filter(isRealSrc).map(settle));
  const failed = [...document.images].filter(
    (i) => isRealSrc(i) && i.complete && i.naturalWidth === 0,
  );
  for (const img of failed) {
    const u = new URL(img.src, location.href);
    u.searchParams.set('v', Date.now());
    img.src = u.toString();
  }
  if (failed.length) await Promise.all(failed.map(settle));
  const broken = [...document.images].filter(
    (i) => isRealSrc(i) && i.complete && i.naturalWidth === 0,
  );
  // 破损判定只针对本站资源（部署门禁抓本站回归）；外部图失败为环境抖动，不计入失败
  const localBroken = broken.filter(
    (i) => new URL(i.src, location.href).origin === location.origin,
  ).length;
  return {
    path: location.pathname,
    title: document.title,
    bodyLen: document.body.innerHTML.length,
    overflowX: de.scrollWidth - de.clientWidth,
    hasNavbar: !!document.getElementById('navbar'),
    hasFooter: !!document.querySelector('footer'),
    brokenImages: localBroken,
    externalBroken: broken.length - localBroken,
  };
})()`;

async function goto(url, settle = 2600) {
	await send("Page.navigate", { url });
	await sleep(settle);
}

async function clickNavByText(text) {
	return evaluate(`(() => {
    const as = [...document.querySelectorAll('a')].filter(a => a.getAttribute('href') && a.textContent.trim().includes(${JSON.stringify(text)}));
    if (!as.length) return { ok: false };
    as[0].click();
    return { ok: true };
  })()`);
}

// 需要预览的页面（不存在的路径会被跳过）
const PAGES = [
	"/",
	"/archive/",
	"/tags/",
	"/categories/",
	"/projects/",
	"/gallery/",
	"/about/",
	"/friends/",
	"/apply/",
	"/sponsor/",
	"/rss/",
	"/atom/",
	"/search/",
];

async function main() {
	if (!CHROME)
		throw new Error("未找到 Chromium，请用 CHROME_PATH 或 --chrome 指定");

	const uptime = await fetch(BASE, { signal: AbortSignal.timeout(5000) })
		.then((r) => r.status)
		.catch(() => null);
	if (uptime === null)
		throw new Error(`无法访问 ${BASE}，请先运行 pnpm preview`);

	const child = spawn(
		CHROME,
		[
			"--headless=new",
			"--no-sandbox",
			"--disable-gpu",
			`--remote-debugging-port=${CDP_PORT}`,
			"--window-size=1440,900",
			"about:blank",
		],
		{ stdio: "ignore" },
	);

	try {
		// 等待 CDP 就绪
		for (let i = 0; i < 30; i++) {
			try {
				await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`, {
					signal: AbortSignal.timeout(1000),
				});
				break;
			} catch {
				await sleep(500);
			}
		}
		await connect();
		await send("Emulation.setDeviceMetricsOverride", {
			width: 1440,
			height: 900,
			deviceScaleFactor: 1,
			mobile: false,
		});

		console.log(`\n[1/5] 页面渲染（${PAGES.length} 个路由，桌面 1440px）`);
		for (const p of PAGES) {
			await goto(`${BASE}${p}`);
			let info = await evaluate(PROBE);
			const renderOK = () =>
				info.bodyLen > 100000 && info.hasNavbar && info.hasFooter;
			if (!renderOK()) {
				// 渲染不通过可能是慢加载/边缘抖动：重试一次再判定，避免静默漏检或误报
				await goto(`${BASE}${p}`, 3500);
				info = await evaluate(PROBE);
			}
			if (/404|not found/i.test(info.title) || info.bodyLen < 50000) {
				console.log(`  ⏭  ${p} 跳过（未启用或 404）`);
				continue;
			}
			check(
				`${p} 渲染`,
				renderOK(),
				`bodyLen=${info.bodyLen}`,
			);
			check(`${p} 无横向溢出`, info.overflowX <= 2, `溢出 ${info.overflowX}px`);
			check(
				`${p} 无破损图`,
				info.brokenImages === 0,
				`破损 ${info.brokenImages}`,
			);
			if (info.externalBroken > 0) {
				console.log(
					`  ⚠  ${p} 外部图片 ${info.externalBroken} 张加载失败（环境抖动，不阻塞）`,
				);
			}
		}

		console.log(
			"\n[2/5] Swup 单程软导航（每程只点一次，避免整数往返掩盖监听器问题）",
		);
		await goto(`${BASE}/`);
		for (const target of ["归档", "标签", "分类", "关于"]) {
			const before = await evaluate(PROBE);
			const clicked = await clickNavByText(target);
			if (!clicked.ok) {
				console.log(`  ⏭  导航项「${target}」未找到，跳过`);
				continue;
			}
			await sleep(2200);
			const after = await evaluate(PROBE);
			check(
				`单程导航 → ${target}`,
				after.path !== before.path &&
					after.bodyLen > 100000 &&
					after.hasNavbar &&
					after.overflowX <= 2,
				`${before.path} → ${after.path}`,
			);
		}

		const backBefore = await evaluate(PROBE);
		await evaluate("history.back()");
		await sleep(2200);
		const backAfter = await evaluate(PROBE);
		check(
			"popstate 后退",
			backAfter.path !== backBefore.path && backAfter.bodyLen > 100000,
			`${backBefore.path} → ${backAfter.path}`,
		);

		console.log("\n[3/5] 文章页 TOC");
		const postPath = process.env.POST_PATH || "/posts/friend-link/";
		await goto(`${BASE}${postPath}`, 3500);
		const toc = await evaluate(`(() => {
      const out = {};
      for (const [name, sel] of [['floating','#floating-toc-content'],['sidebar','#sidebar-toc-content'],['immersive','#immersive-toc-content']]) {
        const c = document.querySelector(sel);
        if (!c) { out[name] = null; continue; }
        const items = [...c.querySelectorAll('a.toc-item')];
        out[name] = {
          count: items.length,
          malformed: items.filter(a => !/toc-level-\\d+/.test(a.className) || !a.getAttribute('data-heading-id') || !a.querySelector('.toc-badge') || !a.querySelector('.toc-label')).length,
        };
      }
      return out;
    })()`);
		const present = Object.entries(toc).filter(([, v]) => v);
		if (present.length === 0) {
			console.log(`  ⏭  ${postPath} 无 TOC 容器，跳过`);
		} else {
			for (const [name, v] of present) {
				check(
					`TOC(${name}) 结构`,
					v.count > 0 && v.malformed === 0,
					`${v.count} 项，malformed ${v.malformed}`,
				);
			}
			await evaluate("window.scrollTo(0, 1600)");
			await sleep(1000);
			const ind = await evaluate(`(() => {
        const el = document.querySelector('#floating-toc-content .toc-active-indicator, #sidebar-toc-content .toc-active-indicator');
        return el ? getComputedStyle(el).opacity : null;
      })()`);
			check(
				"TOC scrollspy 生效",
				ind === null || Number(ind) > 0,
				`indicator opacity=${ind}`,
			);
		}

		console.log("\n[4/5] 移动端 375x812");
		await send("Emulation.setDeviceMetricsOverride", {
			width: 375,
			height: 812,
			deviceScaleFactor: 2,
			mobile: true,
		});
		await goto(`${BASE}/`, 3000);
		const mobile = await evaluate(PROBE);
		check(
			"移动端无横向溢出",
			mobile.overflowX <= 2,
			`溢出 ${mobile.overflowX}px`,
		);
		check(
			"移动端无破损图",
			mobile.brokenImages === 0,
			`破损 ${mobile.brokenImages}`,
		);
		if (mobile.externalBroken > 0) {
			console.log(
				`  ⚠  移动端外部图片 ${mobile.externalBroken} 张加载失败（环境抖动，不阻塞）`,
			);
		}
		const menu = await evaluate(`(() => {
      const b = document.getElementById('nav-menu-switch');
      if (!b) return { ok: false };
      b.click();
      return { ok: true };
    })()`);
		if (menu.ok) {
			await sleep(900);
			const drawer = await evaluate(`(() => {
        const p = document.getElementById('nav-menu-panel');
        return p ? { exists: true, closed: p.classList.contains('float-panel-closed') } : { exists: false };
      })()`);
			check(
				"移动端导航抽屉可开",
				drawer.exists && !drawer.closed,
				JSON.stringify(drawer),
			);
		}

		console.log("\n[5/5] 定制功能契约（后台 API / 友链申请 / admin 入口）");

		// ── 静态 JSON API（构建产物，本地 preview 与生产一致）──
		const jsonGet = async (path) => {
			const res = await fetch(`${BASE}${path}`, {
				signal: AbortSignal.timeout(8000),
			});
			return res.ok
				? { ok: true, status: res.status, data: await res.json() }
				: { ok: false, status: res.status };
		};

		const adminPosts = await jsonGet("/api/admin-posts.json");
		check("admin-posts.json 200", adminPosts.ok, `HTTP ${adminPosts.status}`);
		check(
			"admin-posts 结构安全（无正文/明文密码）",
			adminPosts.ok &&
				Array.isArray(adminPosts.data) &&
				adminPosts.data.every(
					(p) =>
						typeof p.passwordProtected === "boolean" &&
						!("body" in p) &&
						!("password" in p),
				),
			adminPosts.ok ? `${adminPosts.data.length} 条` : "不可用",
		);

		const allMeta = await jsonGet("/api/allPostMeta.json");
		check("allPostMeta.json 200", allMeta.ok, `HTTP ${allMeta.status}`);
		check(
			"allPostMeta 结构",
			allMeta.ok &&
				Array.isArray(allMeta.data) &&
				allMeta.data.every(
					(p) =>
						typeof p.id === "string" &&
						typeof p.published === "number" &&
						typeof p.password === "boolean",
				),
			allMeta.ok ? `${allMeta.data.length} 条` : "不可用",
		);

		const dyn = await jsonGet("/api/dynamic.json");
		check("dynamic.json 200", dyn.ok, `HTTP ${dyn.status}`);
		check(
			"dynamic.json 结构",
			dyn.ok &&
				Array.isArray(dyn.data) &&
				dyn.data.every(
					(d) =>
						typeof d.id === "string" &&
						typeof d.published === "number" &&
						typeof d.html === "string",
				),
			dyn.ok ? `${dyn.data.length} 条` : "不可用",
		);

		// ── 页面（CDP 探测）──
		await goto(`${BASE}/apply/`);
		const apply = await evaluate(PROBE);
		check(
			"友链申请页渲染",
			apply.bodyLen > 50000 &&
				(await evaluate("!!document.getElementById('apply-form')")),
			`bodyLen=${apply.bodyLen}`,
		);

		await goto(`${BASE}/admin/`);
		const adminShell = await evaluate(`(() => {
      return {
        path: location.pathname,
        title: document.title,
        hasApp: !!document.getElementById('app'),
      };
    })()`);
		check(
			"admin 后台壳加载",
			adminShell.hasApp && /后台管理/.test(adminShell.title),
			JSON.stringify(adminShell),
		);

		// ── Cloudflare Functions（仅生产可用；本地 preview 无 Functions 则跳过）──
		const cfgRes = await fetch(`${BASE}/admin/config.yml`, {
			signal: AbortSignal.timeout(8000),
		});
		if (cfgRes.status === 404 || cfgRes.status === 405) {
			console.log("  ⏭  /admin/config.yml 无 Functions（本地 preview），跳过");
		} else {
			check("admin config.yml 200", cfgRes.ok, `HTTP ${cfgRes.status}`);
		}

		// 友链申请负向用例：只测被拦（不写仓库）；429=命中限流亦属被拦
		const submitUrl = `${BASE}/submit-friend-request`;
		const rejectOK = (status) => status === 400 || status === 429;
		const probe = await fetch(submitUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "not-json",
			signal: AbortSignal.timeout(8000),
		});
		if (probe.status === 404 || probe.status === 405) {
			console.log(
				"  ⏭  /submit-friend-request 无 Functions（本地 preview），跳过",
			);
		} else {
			check(
				"友链申请 非法 JSON 被拒",
				rejectOK(probe.status),
				`HTTP ${probe.status}`,
			);
			const missing = await fetch(submitUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "测试" }),
				signal: AbortSignal.timeout(8000),
			});
			check(
				"友链申请 缺 siteurl 被拒",
				rejectOK(missing.status),
				`HTTP ${missing.status}`,
			);
			const huge = await fetch(submitUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "x".repeat(20 * 1024) }),
				signal: AbortSignal.timeout(8000),
			});
			check(
				"友链申请 超大 body 被拒(413)",
				huge.status === 413,
				`HTTP ${huge.status}`,
			);
		}

		console.log("\n控制台错误");
		check(
			"无控制台错误",
			consoleErrors.length === 0,
			consoleErrors.length ? `\n      ${consoleErrors.join("\n      ")}` : "",
		);
	} finally {
		child.kill("SIGKILL");
	}

	console.log(`\n===== 结果：${checks - failures.length}/${checks} 通过 =====`);
	if (failures.length) {
		console.log("失败项：");
		failures.forEach((f) => {
			console.log(`  - ${f}`);
		});
		process.exit(1);
	}
}

main().catch((e) => {
	console.error(`\n验证脚本出错：${e.message}`);
	process.exit(2);
});
