// 看板娘资源裁剪构建后脚本
// 已废弃：看板娘功能已彻底清除，此脚本现为空操作（保留以避免构建中断）
import fs from "node:fs/promises";
import path from "node:path";

const DIST_DIR = "dist";
const PIO_ROOT = path.join(DIST_DIR, "pio");

async function main() {
	try {
		await fs.rm(PIO_ROOT, { recursive: true, force: true });
	} catch {
		// pio 目录不存在或已删除，忽略
	}
}

main();
