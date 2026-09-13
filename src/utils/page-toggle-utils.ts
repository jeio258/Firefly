import type { SiteConfig } from "@/types/siteConfig";
import { parseBooleanEnv, readPublicEnv } from "@/utils/env-utils";

// 页面开关的环境变量覆盖工具
// 把「环境变量开启/关闭页面」的逻辑收敛在这里，让 siteConfig.ts 保持纯配置

// 读取页面开关环境变量：PUBLIC_PAGES_<KEY>=true/false，KEY 为 pages 里的键名大写
function readPageEnv(key: string): unknown {
	return readPublicEnv(`PUBLIC_PAGES_${key.toUpperCase()}`);
}

// 应用页面开关的环境变量覆盖：PUBLIC_PAGES_<KEY> 优先于 siteConfig.pages.<KEY>
// 这样在部署平台（Vercel / Cloudflare 等）配置环境变量即可开启/关闭页面，无需修改配置文件
// 变量名必须带 PUBLIC_ 前缀，否则不会注入到浏览器端
export function resolvePageToggles(
	pages: SiteConfig["pages"],
): SiteConfig["pages"] {
	const result = { ...pages };
	for (const key of Object.keys(result) as (keyof SiteConfig["pages"])[]) {
		const parsed = parseBooleanEnv(readPageEnv(key));
		if (parsed !== undefined) {
			result[key] = parsed;
		}
	}
	return result;
}
