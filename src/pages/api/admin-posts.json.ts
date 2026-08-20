import { getSortedPosts } from "@/utils/content-utils";

/**
 * 公开的文章元数据列表（供管理后台文章列表使用）。
 *
 * 安全说明：
 * - 不返回 post.body（完整 Markdown 源码）：加密文章正文不应公开
 * - password 仅返回布尔值：明文密码只应通过 GitHub API（带 OAuth token）获取
 * - 如需编辑文章正文/密码，请由管理后台直接调用 GitHub Contents API
 */
export async function GET() {
	const posts = await getSortedPosts();
	const data = posts.map((post) => ({
		path: `src/content/posts/${post.id}.md`,
		title: post.data.title,
		description: post.data.description || "",
		published: post.data.published,
		updated: post.data.updated || post.data.published,
		draft: post.data.draft ?? false,
		tags: post.data.tags || [],
		category: post.data.category || "",
		image: post.data.image || "",
		pinned: post.data.pinned ?? false,
		comment: post.data.comment ?? true,
		author: post.data.author || "",
		sourceLink: post.data.sourceLink || "",
		passwordProtected: !!post.data.password,
	}));
	return new Response(JSON.stringify(data), {
		headers: { "Content-Type": "application/json" },
	});
}
