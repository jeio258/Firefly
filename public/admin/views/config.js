import { getRawFile, saveRawFile } from '../api.js';
import { store } from '../store.js';
import { emptyState, toast } from '../ui.js';
import { escapeAttr, escapeHtml } from '../utils.js';

const CONFIG_PATH = '.pages.yml';

function splitFrontmatter(text) {
	const match = (text || '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) return { data: {}, body: text || '', hasFrontmatter: false };
	let data = {};
	try {
		data = jsyaml.load(match[1]) || {};
	} catch (e) {
		toast(`frontmatter 解析失败：${e.message}`, 'error');
	}
	return { data, body: text.slice(match[0].length), hasFrontmatter: true };
}

function buildFrontmatter(data, body) {
	const yaml = jsyaml
		.dump(data, { lineWidth: -1, noRefs: true, quotingType: '"' })
		.trimEnd();
	return `---\n${yaml}\n---\n\n${body.replace(/^\n+/, '')}`;
}

function fieldControl(field, value) {
	const path = escapeAttr(field.name);
	if (field.type === 'boolean') {
		return `<label class="inline-flex items-center gap-2 text-sm text-slate-600">
			<input data-fm="${path}" data-type="boolean" type="checkbox" class="h-4 w-4 accent-(--primary)"${value === true ? ' checked' : ''} />
			<span>启用</span></label>`;
	}
	if (field.type === 'text') {
		return `<textarea data-fm="${path}" data-type="text" rows="3" class="field">${escapeHtml(String(value ?? ''))}</textarea>`;
	}
	return `<input data-fm="${path}" data-type="string" type="text" class="field" value="${escapeAttr(String(value ?? ''))}" />`;
}

function listItem(item) {
	const desc = item.description
		? `<p class="mt-1 text-[11px] text-slate-400">${escapeHtml(item.description)}</p>`
		: '';
	const badgeText =
		item.type === 'collection' ? '集合' : item.format === 'code' ? '代码' : '文档';
	return `<a href="#/config?file=${encodeURIComponent(item.path || '')}&name=${encodeURIComponent(item.name || '')}"
		class="flex items-start gap-3 rounded-(--admin-radius) border border-(--line-divider) bg-(--card-bg) p-3 transition-colors hover:bg-slate-50">
		<span class="mt-0.5 text-slate-400"><i class="fas ${item.type === 'collection' ? 'fa-layer-group' : 'fa-file-code'}"></i></span>
		<span class="min-w-0 flex-1">
			<span class="flex items-center gap-2">
				<span class="truncate text-sm font-medium text-slate-800">${escapeHtml(item.label || item.name)}</span>
				<span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">${badgeText}</span>
			</span>
			<span class="mt-0.5 block truncate font-mono text-[11px] text-slate-400">${escapeHtml(item.path || '')}</span>
			${desc}
		</span>
		<span class="mt-0.5 text-slate-300"><i class="fas fa-angle-right"></i></span>
	</a>`;
}

export async function renderConfig(container, params) {
	const filePath = params?.get('file');
	if (filePath) return renderConfigFile(container, filePath, params.get('name'));

	container.innerHTML = '<p class="text-sm text-slate-500">正在读取配置结构…</p>';

	let cfg;
	try {
		const raw = await getRawFile(store.owner, store.repo, store.branch, CONFIG_PATH, store.token);
		if (!raw.text) throw new Error(`仓库根目录缺少 ${CONFIG_PATH}`);
		cfg = jsyaml.load(raw.text) || {};
	} catch (e) {
		container.innerHTML = emptyState('配置结构读取失败', e.message, 'fa-triangle-exclamation');
		return;
	}

	const groups = cfg.content || [];
	container.innerHTML = `
	<div class="space-y-5">
		<div class="card flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
			<div class="text-slate-600">
				<i class="fas fa-circle-info mr-1 text-brand-500"></i>
				结构定义在 <code class="rounded bg-slate-100 px-1.5 py-0.5 text-[12px]">${escapeHtml(CONFIG_PATH)}</code>，
				保存后需等待 Cloudflare Pages 构建生效。
			</div>
			<span class="text-[11px] text-slate-400">${groups.length} 个分组</span>
		</div>
		${groups
			.map(
				(group) => `
		<section class="card p-5">
			<div class="mb-3">
				<h2 class="text-sm font-semibold text-slate-800">${escapeHtml(group.label || group.name)}</h2>
				${group.description ? `<p class="mt-1 text-[11px] text-slate-400">${escapeHtml(group.description)}</p>` : ''}
			</div>
			<div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
				${(group.items || []).map(listItem).join('')}
			</div>
		</section>`,
			)
			.join('')}
	</div>`;

	const media = cfg.media || [];
	if (media.length) {
		container.insertAdjacentHTML(
			'beforeend',
			`<section class="card mt-5 p-5">
				<h2 class="mb-2 text-sm font-semibold text-slate-800">媒体目录</h2>
				<ul class="space-y-1 text-[12px] text-slate-500">
					${media
						.map(
							(m) =>
								`<li><span class="font-medium text-slate-700">${escapeHtml(m.label || m.name)}</span> · <code>${escapeHtml(m.input || '')}</code> → <code>${escapeHtml(m.output || '')}</code></li>`,
						)
						.join('')}
				</ul>
				<p class="mt-2 text-[11px] text-slate-400">媒体上传暂未接入，请通过仓库直接添加文件。</p>
			</section>`,
		);
	}
}

async function renderConfigFile(container, filePath, name) {
	container.innerHTML = `<p class="text-sm text-slate-500">正在读取 ${escapeHtml(filePath)}…</p>`;

	let raw;
	try {
		raw = await getRawFile(store.owner, store.repo, store.branch, filePath, store.token);
	} catch (e) {
		container.innerHTML = emptyState('文件读取失败', e.message, 'fa-triangle-exclamation');
		return;
	}
	if (raw.text === null) {
		container.innerHTML = emptyState('文件不存在', `${filePath} 未找到（可能是新文件，请先在仓库创建）`, 'fa-file-circle-question');
		return;
	}

	const isCode = /\.(ts|tsx|js|mjs|json|html|css|yml|yaml)$/i.test(filePath);
	const isMarkdown = /\.(md|mdx)$/i.test(filePath);
	const fm = isMarkdown ? splitFrontmatter(raw.text) : null;

	const schema = await loadSchema();
	const item = findItem(schema, filePath);
	const fields = (item?.fields || []).filter((f) => f.name !== 'body');
	// schema 声明为 yaml-frontmatter 时始终用字段模式：无 frontmatter 的文件把全文当正文，
	// 避免 about.md 这类纯 Markdown 退化成裸文本编辑、丢失标题字段。
	const frontmatterMode =
		item?.format === 'yaml-frontmatter' && isMarkdown;

	const back = `<a href="#/config" class="btn-secondary btn-sm"><i class="fas fa-arrow-left"></i>返回</a>`;
	const saveBtn = `<button id="cfg-save" class="btn-primary btn-sm"><i class="fas fa-floppy-disk"></i>保存并提交</button>`;

	const header = `
	<div class="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0">
			<p class="truncate text-sm font-semibold text-slate-800">${escapeHtml(name || item?.label || filePath)}</p>
			<p class="truncate font-mono text-[11px] text-slate-400">${escapeHtml(filePath)}</p>
		</div>
		<div class="flex shrink-0 gap-2">${back}${saveBtn}</div>
	</div>`;

	let bodyHtml = '';
	if (frontmatterMode) {
		bodyHtml = `
		<section class="card mt-4 p-5">
			<h2 class="mb-3 text-sm font-semibold text-slate-800">文档信息</h2>
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
				${fields
					.map(
						(f) => `<div>
							<label class="label">${escapeHtml(f.label || f.name)}</label>
							${fieldControl(f, fm.data[f.name])}
						</div>`,
					)
					.join('')}
			</div>
			<div class="mt-4">
				<label class="label">正文</label>
				<textarea id="cfg-body" rows="18" class="field font-mono text-[13px]">${escapeHtml(fm && fm.hasFrontmatter ? fm.body : raw.text)}</textarea>
			</div>
		</section>`;
	} else if (isCode) {
		bodyHtml = `
		<section class="card mt-4 p-5">
			<textarea id="cfg-code" spellcheck="false" rows="28"
				class="field w-full font-mono text-[12.5px] leading-relaxed">${escapeHtml(raw.text)}</textarea>
		</section>`;
	} else {
		bodyHtml = `
		<section class="card mt-4 p-5">
			<textarea id="cfg-code" spellcheck="false" rows="24"
				class="field w-full font-mono text-[12.5px] leading-relaxed">${escapeHtml(raw.text)}</textarea>
		</section>`;
	}

	container.innerHTML = `<div class="space-y-4">${header}${bodyHtml}</div>`;

	container.querySelector('#cfg-save').onclick = async () => {
		let text;
		if (!frontmatterMode) {
			text = container.querySelector('#cfg-code').value;
		} else {
			const next = { ...((fm && fm.data) || {}) };
			container.querySelectorAll('[data-fm]').forEach((el) => {
				const key = el.dataset.fm;
				if (el.dataset.type === 'boolean') next[key] = el.checked;
				else if (el.value === '') delete next[key];
				else next[key] = el.value;
			});
			text = buildFrontmatter(next, container.querySelector('#cfg-body').value);
		}

		const btn = container.querySelector('#cfg-save');
		btn.disabled = true;
		try {
			let res = await saveRawFile(
				store.owner, store.repo, store.branch, filePath, text, raw.sha, store.token,
				`chore: 更新 ${filePath}（后台）`,
			);
			if (!res.ok && res.status === 409) {
				const fresh = await getRawFile(store.owner, store.repo, store.branch, filePath, store.token);
				raw.sha = fresh.sha;
				res = await saveRawFile(
					store.owner, store.repo, store.branch, filePath, text, raw.sha, store.token,
					`chore: 更新 ${filePath}（后台）`,
				);
			}
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.message || `保存失败（${res.status}）`);
			}
			const data = await res.json().catch(() => ({}));
			raw.sha = data.content?.sha || raw.sha;
			toast('已提交，等待 Cloudflare Pages 构建生效');
		} catch (e) {
			toast(e.message || String(e), 'error');
		} finally {
			btn.disabled = false;
		}
	};
}

let schemaCache = null;
async function loadSchema() {
	if (schemaCache) return schemaCache;
	try {
		const raw = await getRawFile(store.owner, store.repo, store.branch, CONFIG_PATH, store.token);
		schemaCache = raw.text ? jsyaml.load(raw.text) || {} : {};
	} catch (_) {
		schemaCache = {};
	}
	return schemaCache;
}

function findItem(schema, filePath) {
	for (const group of schema.content || []) {
		for (const item of group.items || []) {
			if (item.path === filePath) return item;
		}
	}
	return null;
}
