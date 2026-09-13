// 环境变量读取与布尔解析：页面走 Vite/Astro（import.meta.env 会被静态替换），
// 构建脚本（scripts/*.ts 用 tsx 在 Node 里跑）没有 import.meta.env，回退读 process.env

const TRUTHY_VALUES = ["true", "1", "on", "yes", "enable", "enabled"];
const FALSY_VALUES = ["false", "0", "off", "no", "disable", "disabled"];

// 解析布尔类型的环境变量，返回 undefined 表示未设置或取值无法识别
export function parseBooleanEnv(raw: unknown): boolean | undefined {
	if (typeof raw !== "string") return undefined;
	const value = raw.trim().toLowerCase();
	if (TRUTHY_VALUES.includes(value)) return true;
	if (FALSY_VALUES.includes(value)) return false;
	return undefined;
}

// 读取 PUBLIC_ 前缀环境变量，变量名必须带 PUBLIC_ 前缀才会注入到浏览器端
export function readPublicEnv(envKey: string): unknown {
	try {
		return (import.meta.env as Record<string, unknown>)[envKey];
	} catch {
		return typeof process === "undefined" ? undefined : process.env[envKey];
	}
}
