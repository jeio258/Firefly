// Firefly CloudFlare-ImgBed 图床对接配置
//
// 注意：API Token 通过环境变量注入（构建/运行时），禁止硬编码在源码中。
// 设置方式：部署平台构建环境变量或 .env 文件（勿提交）：IMG_BED_TOKEN=xxx
// （兼容 SECRET_IMG_BED_TOKEN 命名）。未设置时图床相册优雅降级为空列表。

// 读取图床 API Token：Astro/Vite 走 import.meta.env，tsx/Node 脚本回退 process.env
function readApiToken(): string {
	const candidates = ["IMG_BED_TOKEN", "SECRET_IMG_BED_TOKEN"];
	try {
		const meta = import.meta.env as Record<string, unknown>;
		for (const key of candidates) {
			const v = meta[key];
			if (typeof v === "string" && v.trim()) return v.trim();
		}
	} catch {
		// import.meta.env 不可用（Node/tsx 脚本）时走 process.env
	}
	if (typeof process !== "undefined") {
		for (const key of candidates) {
			const v = process.env[key];
			if (v?.trim()) return v.trim();
		}
	}
	return "";
}

export const imgBedConfig: {
	baseUrl: string;
	apiToken: string;
	pageSize: number;
} = {
	// CloudFlare-ImgBed 部署域名
	baseUrl: "https://imge.994613.xyz",
	// API Token（list 权限）— 从环境变量 IMG_BED_TOKEN / SECRET_IMG_BED_TOKEN 读取
	apiToken: readApiToken(),
	// 每次请求数量
	pageSize: 50,
};
