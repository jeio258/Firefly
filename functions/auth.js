// OAuth 授权入口：生成带 HMAC 签名的 state，防止 CSRF。
// state 格式：`<randomUUID>.<hex(hmac_sha256(uuid, client_secret))>`
// callback.js 会用同一 secret 验签，攻击者无法伪造有效 state。
export async function onRequest(context) {
	const { env, request } = context;
	const clientId = env.GITHUB_CLIENT_ID;
	const clientSecret = env.GITHUB_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		return new Response(
			"GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not configured",
			{
				status: 500,
			},
		);
	}

	const uuid = crypto.randomUUID();
	const signature = await signState(uuid, clientSecret);
	const state = `${uuid}.${signature}`;

	const url = new URL(request.url);
	const redirectUri = `${url.origin}/callback`;

	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		scope: "repo,user",
		state,
	});

	return Response.redirect(
		`https://github.com/login/oauth/authorize?${params}`,
		302,
	);
}

async function signState(uuid, secret) {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(uuid),
	);
	return [...new Uint8Array(sig)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
