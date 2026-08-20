// 友链申请接口
// 安全加固：
// 1. 请求体大小限制（16KB）
// 2. 字段白名单 + 长度/格式校验
// 3. YAML 输出一律双引号转义，杜绝 YAML 注入
// 4. 可选 KV 限流（绑定 FRIEND_REQ_KV 后生效，同 IP 每 10 分钟 3 次）
export async function onRequest(context) {
	const { request, env } = context;

	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	try {
		// 1. 体积限制
		const contentLength = Number(request.headers.get("Content-Length") || 0);
		if (contentLength > 16 * 1024) {
			return json({ error: "Request body too large (max 16KB)" }, 413);
		}

		// 2. 限流（可选，需绑定 KV）
		if (env.FRIEND_REQ_KV) {
			const ok = await rateLimit(env.FRIEND_REQ_KV, request);
			if (!ok) {
				return json(
					{ error: "Too many requests, please try again later" },
					429,
				);
			}
		}

		// 3. 解析并校验字段
		let friendData;
		try {
			friendData = await request.json();
		} catch {
			return json({ error: "Invalid JSON body" }, 400);
		}
		const cleaned = sanitizeFriendData(friendData);
		if (cleaned.error) {
			return json({ error: cleaned.error }, 400);
		}

		const GITHUB_TOKEN = env.GITHUB_TOKEN;
		const REPO_OWNER = env.REPO_OWNER || "jeio258";
		const REPO_NAME = env.REPO_NAME || "Firefly";
		const BRANCH = env.BRANCH || "master";
		const REQUESTS_PATH = "public/data/friend_requests.yaml";

		if (!GITHUB_TOKEN) {
			throw new Error("GITHUB_TOKEN is not configured");
		}

		// 4. 获取现有文件
		const getUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${REQUESTS_PATH}?ref=${BRANCH}`;
		const getRes = await fetch(getUrl, {
			headers: {
				Authorization: `token ${GITHUB_TOKEN}`,
				"User-Agent": "Cloudflare Worker",
			},
		});

		let sha = null;
		let currentData = [];

		if (getRes.ok) {
			const file = await getRes.json();
			sha = file.sha;
			const yamlText = base64DecodeUTF8(file.content);
			currentData = parseYamlArray(yamlText);
		} else if (getRes.status !== 404) {
			const errorText = await getRes.text();
			throw new Error(`GitHub API error ${getRes.status}: ${errorText}`);
		}

		// 5. 追加新申请（enabled 由管理员在审核时决定，提交时一律 false）
		const newData = [...currentData, { ...cleaned.data, enabled: false }];
		const yamlStr = dumpYamlArray(newData);
		const base64Content = base64EncodeUTF8(yamlStr);

		// 6. 写回 GitHub（sha 冲突时重试一次，缓解并发竞态）
		let putRes = await putFile(
			GITHUB_TOKEN,
			REPO_OWNER,
			REPO_NAME,
			REQUESTS_PATH,
			BRANCH,
			sha,
			cleaned.data.title,
			base64Content,
		);
		if (!putRes.ok && putRes.status === 409 && sha) {
			// 重读最新 sha 后重试
			const reGet = await fetch(getUrl, {
				headers: {
					Authorization: `token ${GITHUB_TOKEN}`,
					"User-Agent": "Cloudflare Worker",
				},
			});
			if (reGet.ok) {
				const file = await reGet.json();
				putRes = await putFile(
					GITHUB_TOKEN,
					REPO_OWNER,
					REPO_NAME,
					REQUESTS_PATH,
					BRANCH,
					file.sha,
					cleaned.data.title,
					base64Content,
				);
			}
		}

		if (putRes.ok) {
			return json({ success: true });
		}
		const err = await putRes.json().catch(() => ({}));
		throw new Error(`GitHub PUT error: ${err.message || putRes.status}`);
	} catch (error) {
		return json({ error: error.message }, 500);
	}
}

// ---------- 工具函数 ----------

async function putFile(
	token,
	owner,
	repo,
	path,
	branch,
	sha,
	title,
	base64Content,
) {
	const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
	return fetch(putUrl, {
		method: "PUT",
		headers: {
			Authorization: `token ${token}`,
			"Content-Type": "application/json",
			"User-Agent": "Cloudflare Worker",
		},
		body: JSON.stringify({
			message: `友链申请: ${title}`,
			content: base64Content,
			branch: branch,
			sha: sha || undefined,
		}),
	});
}

function json(obj, status = 200) {
	return new Response(JSON.stringify(obj), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

// ---------- 字段校验 ----------

const MAX_LEN = { title: 60, siteurl: 200, imgurl: 500, desc: 200, tags: 10 };

function sanitizeFriendData(raw) {
	const out = {};
	if (typeof raw !== "object" || raw === null) {
		return { error: "Invalid body" };
	}

	const str = (v) => (typeof v === "string" ? v.trim() : "");

	const title = str(raw.title);
	if (!title || title.length > MAX_LEN.title) {
		return { error: `title is required and must be <= ${MAX_LEN.title} chars` };
	}
	out.title = title;

	const siteurl = str(raw.siteurl);
	if (!isValidHttpUrl(siteurl) || siteurl.length > MAX_LEN.siteurl) {
		return { error: "siteurl must be a valid http(s) URL" };
	}
	out.siteurl = siteurl;

	const imgurl = str(raw.imgurl);
	if (imgurl) {
		if (!isValidHttpUrl(imgurl) || imgurl.length > MAX_LEN.imgurl) {
			return { error: "imgurl must be a valid http(s) URL" };
		}
		out.imgurl = imgurl;
	}

	const desc = str(raw.desc);
	if (desc.length > MAX_LEN.desc) {
		return { error: `desc must be <= ${MAX_LEN.desc} chars` };
	}
	if (desc) out.desc = desc;

	if (raw.tags !== undefined) {
		const tags = Array.isArray(raw.tags)
			? raw.tags
					.map((t) => str(t))
					.filter(Boolean)
					.slice(0, MAX_LEN.tags)
			: str(raw.tags)
					.split(/[,，]/)
					.map((t) => t.trim())
					.filter(Boolean)
					.slice(0, MAX_LEN.tags);
		for (const t of tags) {
			if (t.length > 30) return { error: "each tag must be <= 30 chars" };
		}
		if (tags.length > 0) out.tags = tags;
	}

	return { data: out };
}

function isValidHttpUrl(value) {
	try {
		const u = new URL(value);
		return u.protocol === "http:" || u.protocol === "https:";
	} catch {
		return false;
	}
}

// ---------- KV 限流 ----------

async function rateLimit(kv, request) {
	const ip = request.headers.get("CF-Connecting-IP") || "unknown";
	const key = `friend-req:${ip}`;
	const now = Date.now();
	const windowMs = 10 * 60 * 1000; // 10 分钟
	const max = 3;

	const raw = await kv.get(key, "json").catch(() => null);
	const record = raw || { count: 0, start: now };

	if (now - record.start > windowMs) {
		record.count = 0;
		record.start = now;
	}

	if (record.count >= max) return false;

	record.count += 1;
	await kv
		.put(key, JSON.stringify(record), {
			expirationTtl: Math.ceil(windowMs / 1000),
		})
		.catch(() => {});
	return true;
}

// ---------- UTF-8 安全的 Base64 编解码 ----------

function base64EncodeUTF8(str) {
	const bytes = new TextEncoder().encode(str);
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function base64DecodeUTF8(base64Str) {
	const binaryStr = atob(base64Str);
	const bytes = new Uint8Array(binaryStr.length);
	for (let i = 0; i < binaryStr.length; i++) {
		bytes[i] = binaryStr.charCodeAt(i);
	}
	return new TextDecoder().decode(bytes);
}

// ---------- 简易 YAML 数组处理 ----------

function parseYamlArray(yamlText) {
	if (!yamlText || yamlText.trim() === "") return [];
	const lines = yamlText.split("\n");
	const items = [];
	let currentItem = {};
	let inItem = false;

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === "" || trimmed.startsWith("#")) continue;

		if (trimmed.startsWith("- ")) {
			if (inItem) items.push(currentItem);
			currentItem = {};
			inItem = true;
			const kv = trimmed.substring(2).split(": ");
			if (kv.length === 2) {
				currentItem[kv[0]] = parseYamlValue(kv[1]);
			}
		} else if (inItem && trimmed.includes(": ")) {
			const kv = trimmed.split(": ");
			if (kv.length === 2) {
				currentItem[kv[0].trim()] = parseYamlValue(kv.slice(1).join(": "));
			}
		}
	}
	if (inItem) items.push(currentItem);
	return items;
}

function parseYamlValue(rawValue) {
	const value = rawValue.trim();
	if (value === "true") return true;
	if (value === "false") return false;
	if (!isNaN(value) && value !== "") return Number(value);
	if (
		(value.startsWith("'") && value.endsWith("'")) ||
		(value.startsWith('"') && value.endsWith('"'))
	) {
		return value.slice(1, -1);
	}
	if (value.startsWith("[") && value.endsWith("]")) {
		return value
			.slice(1, -1)
			.split(",")
			.map((v) => v.trim().replace(/['"]/g, ""));
	}
	return value;
}

// 输出时所有字符串值一律双引号转义，防止 YAML 注入
function yamlQuote(value) {
	const s = String(value);
	return (
		'"' +
		s
			.replace(/\\/g, "\\\\")
			.replace(/"/g, '\\"')
			.replace(/\n/g, "\\n")
			.replace(/\r/g, "\\r")
			.replace(/\t/g, "\\t") +
		'"'
	);
}

function dumpYamlArray(data) {
	if (!Array.isArray(data)) return "";
	return (
		data
			.map((item) => {
				const lines = ["- title: " + yamlQuote(item.title || "")];
				if (item.siteurl) lines.push("  siteurl: " + yamlQuote(item.siteurl));
				if (item.imgurl) lines.push("  imgurl: " + yamlQuote(item.imgurl));
				if (item.desc) lines.push("  desc: " + yamlQuote(item.desc || ""));
				if (item.tags && Array.isArray(item.tags)) {
					lines.push("  tags: [" + item.tags.map(yamlQuote).join(", ") + "]");
				}
				if (item.weight !== undefined) lines.push("  weight: " + item.weight);
				if (item.enabled !== undefined)
					lines.push("  enabled: " + item.enabled);
				return lines.join("\n");
			})
			.join("\n") + "\n"
	);
}
