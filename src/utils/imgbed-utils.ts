// CloudFlare-ImgBed API 对接工具（构建时获取图片列表）
import { imgBedConfig } from "@/config/imgBedConfig";

interface ImgBedFile {
	name: string;
	metadata?: {
		Channel?: string;
		TimeStamp?: string;
		"File-Mime"?: string;
		"File-Size"?: string;
	};
}

interface ImgBedListResponse {
	files?: ImgBedFile[];
	totalCount?: number;
}

/**
 * 从 CloudFlare-ImgBed 获取所有图片 URL 列表
 * 构建时调用，结果通过 urls.txt 机制注入相册
 */
export async function fetchImgBedImages(): Promise<string[]> {
	const { baseUrl, apiToken, pageSize } = imgBedConfig;
	const allFiles: string[] = [];
	let start = 0;

	try {
		while (true) {
			const url = `${baseUrl}/api/manage/list?fileType=image&start=${start}&count=${pageSize}`;
			const res = await fetch(url, {
				headers: { Authorization: `Bearer ${apiToken}` },
				signal: AbortSignal.timeout(15000),
			});
			if (!res.ok) {
				console.error(`[ImgBed] API error: ${res.status}`);
				break;
			}
			const data: ImgBedListResponse = await res.json();
			if (!data.files || data.files.length === 0) break;

			for (const f of data.files) {
				allFiles.push(`${baseUrl}/${f.name}`);
			}

			if (data.files.length < pageSize) break;
			start += pageSize;
		}
	} catch (e) {
		console.error("[ImgBed] Fetch failed:", e);
	}

	return allFiles;
}

/**
 * 生成 urls.txt 内容（供 gallery-utils 读取）
 */
export function buildUrlsText(images: string[]): string {
	return [
		"# CloudFlare-ImgBed 远程图片（自动生成，请勿手动编辑）",
		...images,
	].join("\n");
}
