import { getRawFile, saveRawFile } from '../api.js';
import { store } from '../store.js';
import { emptyState, toast } from '../ui.js';
import { escapeAttr, escapeHtml } from '../utils.js';
import {
	fieldsToGroups,
	patchConfigText,
	parseConfigFields,
} from './config-form.js';

const CONFIG_PATH = '.pages.yml';

const LABELS = {
	title: '标题',
	subtitle: '副标题',
	site_url: '站点 URL',
	description: '描述',
	keywords: '关键词',
	themeColor: '主题色',
	hue: '色相',
	defaultMode: '默认模式',
	card: '卡片',
	border: '边框',
	followTheme: '跟随主题',
	navbar: '导航栏',
	logo: 'Logo',
	name: '名称',
	mode: '模式',
	widthFull: '全宽导航',
	menuAlign: '菜单对齐',
	navbarMode: '导航栏模式',
	siteStartDate: '站点起始日',
	timezone: '时区',
	categoryBar: '分类导航栏',
	categoryStyle: '分类样式',
	tagStyle: '标签样式',
	foldArticle: '折叠归档',
	postListLayout: '文章列表布局',
	defaultMode2: '默认布局',
	coverPosition: '封面位置',
	descriptionLines: '简介行数',
	showStatsIcons: '统计图标',
	tagsPosition: '标签位置',
	tagsBottomStyle: '底部标签样式',
	meta: '元数据',
	stats: '统计',
	grid: '网格',
	masonry: '瀑布流',
	columnWidth: '列宽',
	coverFullWidth: '封面贴边',
	pagination: '分页',
	postsPerPage: '每页文章数',
	post: '文章页',
	showLastModified: '显示最后编辑',
	outdatedThreshold: '过期阈值(天)',
	share: '分享按钮',
	postNavigation: '上下篇导航',
	relatedPosts: '相关推荐',
	randomPosts: '随机推荐',
	generateOgImages: '生成 OG 图',
	immersiveReading: '沉浸阅读',
	tocPosition: '目录位置',
	vndb: 'VNDB',
	userId: '用户 ID',
	apiUrl: 'API 地址',
	apiToken: 'API 令牌',
	downloadCovers: '下载封面',
	imageOptimization: '图片优化',
	formats: '输出格式',
	quality: '压缩质量',
	noReferrerDomains: '免 referrer 域名',
	feed: '订阅',
	contentMode: '内容模式',
	lang: '语言',
	pages: '页面开关',
	friends: '友链页',
	dynamic: '动态页',
	projects: '项目页',
	gallery: '相册页',
	sponsor: '打赏页',
	enable: '启用',
	avatar: '头像',
	bio: '签名',
	sakuraNum: '樱花数量',
	limitTimes: '循环次数',
	size: '尺寸',
	min: '最小值',
	max: '最大值',
	average: '平均值',
	opacity: '透明度',
	speed: '速度',
	start: '起始速度',
	step: '速度增量',
	playerEnable: '背景视频',
	common: '通用',
	banner: '横幅',
	overlay: '覆盖',
	fullscreen: '全屏',
	src: '背景源',
	type: '类型',
	envId: '环境 ID',
	visitorCount: '访客统计',
	lang2: '语言',
	cssUrl: '自定义 CSS',
	version: '版本',
	serverURLs: '服务地址',
	repo: '仓库',
	repoId: '仓库 ID',
	categoryId: '分类 ID',
	reaction: '反应',
	option: '选项',
	theme: '主题',
	waline: 'Waline',
	twikoo: 'Twikoo',
	artalk: 'Artalk',
	giscus: 'Giscus',
	disqus: 'Disqus',
	shortname: '短名',
	siteConfig: '站点设置',
	pages: '页面开关',
	profileConfig: '个人信息',
	sakuraConfig: '樱花特效',
	commentConfig: '评论系统',
	backgroundWallpaper: '背景壁纸',
	analyticsConfig: '数据统计',
	musicConfig: '音乐播放器',
	sponsorConfig: '打赏页面',
	friendsConfig: '友链数据',
	effectsConfig: '樱花特效',
	galleryConfig: '相册配置',
	pioConfig: '看板娘',
	plantumlConfig: 'PlantUML',
	mermaidConfig: 'Mermaid',
	dynamicConfig: '动态页',
	navBarConfig: '导航栏',
	sidebarConfig: '侧边栏',
	fontConfig: '字体',
	coverImageConfig: '封面图',
	expressiveCodeConfig: '代码块',
	displaySettingsConfig: '显示设置',
	licenseConfig: '许可协议',
	announcementConfig: '公告栏',
	apiKey: 'API Key',
	dark: '暗色',
	light: '亮色',
	styles: '样式',
};

function label(path) {
	const key = path.split('.').pop();
	return LABELS[path] || LABELS[key] || key;
}

function groupLabel(name) {
	return String(name)
		.split(" / ")
		.map((part) => LABELS[part] || part)
		.join(" / ");
}

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

function ensureYaml() {
	if (typeof jsyaml === 'undefined') {
		throw new Error('js-yaml 未加载（CDN 不可达），请刷新或检查网络');
	}
}

function listItem(item) {
	const desc = item.description
		? `<p class="mt-1 text-[11px] text-slate-400">${escapeHtml(item.description)}</p>`
		: '';
	const isCollection = item.type === 'collection';
	const badgeText = isCollection ? '集合' : item.format === 'code' ? '配置' : '文档';
	const href = isCollection
		? '#/posts'
		: `#/config?file=${encodeURIComponent(item.path || '')}&name=${encodeURIComponent(item.name || '')}`;
	return `<a href="${href}"
		class="flex items-start gap-3 rounded-(--admin-radius) border border-(--line-divider) bg-(--card-bg) p-3 transition-colors hover:bg-slate-50">
		<span class="mt-0.5 text-slate-400"><i class="fas ${isCollection ? 'fa-layer-group' : 'fa-file-code'}"></i></span>
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
		ensureYaml();
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
				配置以表单编辑，代码模式仅作高级入口；保存后需等待 Cloudflare Pages 构建生效。
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

function configFieldControl(field, value) {
	const attrs = `data-path="${escapeAttr(field.path)}" data-kind="${field.kind}"`;
	if (field.kind === 'boolean') {
		return `<label class="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
			<input ${attrs} type="checkbox" class="h-4 w-4 accent-(--primary)"${value === true ? ' checked' : ''} />
			<span class="text-slate-500">启用</span></label>`;
	}
	if (field.kind === 'number') {
		return `<input ${attrs} type="number" step="any" class="field" value="${escapeAttr(String(value ?? ''))}" />`;
	}
	if (field.kind === 'list') {
		return `<input ${attrs} type="text" class="field" value="${escapeAttr(
			Array.isArray(value) ? value.join(', ') : String(value ?? ''),
		)}" />`;
	}
	return `<input ${attrs} type="text" class="field" value="${escapeAttr(String(value ?? ''))}" />`;
}

function readConfigField(el) {
	if (el.dataset.kind === 'boolean') return el.checked;
	if (el.dataset.kind === 'number') {
		if (el.value === '') return undefined;
		const n = Number(el.value);
		return Number.isNaN(n) ? undefined : n;
	}
	if (el.dataset.kind === 'list') {
		return el.value
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	}
	return el.value;
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
		const why = /\.[a-z0-9]+$/i.test(filePath)
			? '未找到（新文件请先在仓库创建）'
			: '目录请到「文章管理」操作；文件不存在则需先在仓库创建';
		container.innerHTML = emptyState('无法编辑该路径', `${filePath}：${why}`, 'fa-file-circle-question');
		return;
	}

	const isCode = /\.(ts|tsx|js|mjs|json|yml|yaml)$/i.test(filePath);
	const isHtml = /\.html$/i.test(filePath);
	const isMarkdown = /\.(md|mdx)$/i.test(filePath);

	let schema = {};
	try {
		schema = await loadSchema();
	} catch (_) {}
	const item = findItem(schema, filePath);
	const docFields = (item?.fields || []).filter((f) => f.name !== 'body');

	const parsed = isCode ? parseConfigFields(raw.text) : { fields: [] };
	const hasForm = isCode && parsed.fields.length > 0;
	const fm = isMarkdown ? splitFrontmatter(raw.text) : null;
	const docMode = item?.format === 'yaml-frontmatter' && isMarkdown;

	// 初始值快照，用于只提交改动项
	const initial = {};
	for (const f of parsed.fields) initial[f.path] = JSON.stringify(f.value);

	const header = `
	<div class="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0">
			<p class="truncate text-sm font-semibold text-slate-800">${escapeHtml(name || item?.label || filePath)}</p>
			<p class="truncate font-mono text-[11px] text-slate-400">${escapeHtml(filePath)}</p>
		</div>
		<div class="flex shrink-0 flex-wrap gap-2">
			<a href="#/config" class="btn-secondary btn-sm"><i class="fas fa-arrow-left"></i>返回</a>
			${hasForm ? `<button id="cfg-mode" class="btn-secondary btn-sm"><i class="fas fa-code"></i>代码模式</button>` : ''}
			<button id="cfg-save" class="btn-primary btn-sm"><i class="fas fa-floppy-disk"></i>保存并提交</button>
		</div>
	</div>`;

	let body = '';
	if (docMode) {
		const fields = docFields;
		body = `<section class="card mt-4 p-5" data-mode="doc">
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
				${fields
					.map(
						(f) => `<div>
							<label class="label">${escapeHtml(f.label || f.name)}</label>
							<input data-fm="${escapeAttr(f.name)}" data-ftype="${escapeAttr(f.type || 'string')}"
								type="text" class="field" value="${escapeAttr(String((fm?.data || {})[f.name] ?? ''))}" />
						</div>`,
					)
					.join('')}
			</div>
			<div class="mt-4">
				<label class="label">正文</label>
				<textarea id="cfg-body" rows="18" class="field font-mono text-[13px]">${escapeHtml(
					fm?.hasFrontmatter ? fm.body : raw.text,
				)}</textarea>
			</div>
		</section>`;
	} else if (hasForm) {
		const groups = fieldsToGroups(parsed.fields);
		body = `<div class="mt-4 space-y-4" data-mode="form">
			${groups
				.map(
					(group) => `<section class="card p-5">
				<h2 class="mb-4 text-sm font-semibold text-slate-800">${escapeHtml(groupLabel(group.name))}</h2>
				<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
					${group.items
						.map(
							(f) => `<div>
								<label class="label">${escapeHtml(label(f.path))}</label>
								${configFieldControl(f, f.value)}
								<p class="mt-1 font-mono text-[10px] text-slate-300">${escapeHtml(f.path)}</p>
							</div>`,
						)
						.join('')}
				</div>
			</section>`,
				)
				.join('')}
		</div>
		<div class="mt-4 hidden" data-mode="code-wrap">
			<section class="card p-5">
				<textarea id="cfg-code" spellcheck="false" rows="28" class="field w-full font-mono text-[12.5px] leading-relaxed">${escapeHtml(raw.text)}</textarea>
			</section>
		</div>`;
	} else {
		body = `<div class="mt-4" data-mode="code-wrap">
			<section class="card p-5">
				<textarea id="cfg-code" spellcheck="false" rows="28" class="field w-full font-mono text-[12.5px] leading-relaxed">${escapeHtml(raw.text)}</textarea>
			</section>
		</div>`;
	}

	container.innerHTML = `<div class="space-y-4">${header}${body}</div>`;

	// 表单 / 代码 切换
	let codeMode = !hasForm;
	const modeBtn = container.querySelector('#cfg-mode');
	if (modeBtn) {
		modeBtn.onclick = () => {
			codeMode = !codeMode;
			const form = container.querySelector('[data-mode="form"]');
			const codeWrap = container.querySelector('[data-mode="code-wrap"]');
			if (form) form.classList.toggle('hidden', codeMode);
			if (codeWrap) codeWrap.classList.toggle('hidden', !codeMode);
			modeBtn.innerHTML = codeMode
				? '<i class="fas fa-list"></i>表单模式'
				: '<i class="fas fa-code"></i>代码模式';
		};
	}

	container.querySelector('#cfg-save').onclick = async () => {
		let text;
		if (docMode) {
			const next = { ...((fm && fm.data) || {}) };
			container.querySelectorAll('[data-fm]').forEach((el) => {
				if (el.value === '') delete next[el.dataset.fm];
				else next[el.dataset.fm] = el.value;
			});
			text = buildFrontmatter(next, container.querySelector('#cfg-body').value);
		} else if (hasForm && !codeMode) {
			const changes = {};
			container.querySelectorAll('[data-path]').forEach((el) => {
				const field = parsed.fields.find((f) => f.path === el.dataset.path);
				if (!field) return;
				const value = readConfigField(el);
				if (value === undefined) return;
				if (JSON.stringify(value) !== initial[field.path]) changes[field.path] = value;
			});
			if (Object.keys(changes).length === 0) {
				toast('没有改动', 'info');
				return;
			}
			text = patchConfigText(raw.text, parsed.fields, changes);
		} else {
			const el = container.querySelector('#cfg-code');
			text = el ? el.value : raw.text;
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
				const b = await res.json().catch(() => ({}));
				throw new Error(b.message || `保存失败（${res.status}）`);
			}
			const data = await res.json().catch(() => ({}));
			raw.sha = data.content?.sha || raw.sha;
			raw.text = text;
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
	ensureYaml();
	const raw = await getRawFile(store.owner, store.repo, store.branch, CONFIG_PATH, store.token);
	schemaCache = raw.text ? jsyaml.load(raw.text) || {} : {};
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
