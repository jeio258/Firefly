import { store, loadToken, setToken, clearToken, loadConfig } from './store.js';
import { escapeHtml } from './utils.js';
import { toast, openModal, closeModal } from './ui.js';
import { renderLoginView } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderPosts } from './views/posts.js';
import { renderEditor } from './views/editor.js';
import { renderFriends } from './views/friends.js';

let shell = null;

// OAuth 弹窗 postMessage 协议须与旧后台一致
function loginWithGithub(onDone) {
    const popup = window.open('/auth', '_blank', 'width=800,height=600');
    if (!popup || popup.closed) {
        window.location.href = '/auth';
        return;
    }
    let resolved = false;
    const cleanup = () => {
        window.removeEventListener('message', handler);
        window.removeEventListener('storage', storageHandler);
        clearInterval(timer);
    };
    const handler = (e) => {
        if (e.origin !== window.location.origin) return;
        if (typeof e.data === 'string' && e.data.startsWith('authorization:github:success:')) {
            try {
                const d = JSON.parse(e.data.replace('authorization:github:success:', ''));
                setToken(d.token);
                resolved = true;
                cleanup();
                onDone();
            } catch {}
        }
    };
    const storageHandler = (e) => {
        if (e.key === 'oauth_token_received' && e.newValue) {
            setToken(e.newValue);
            resolved = true;
            cleanup();
            onDone();
        }
    };
    const timer = setInterval(() => {
        if (popup.closed && !resolved) cleanup();
    }, 500);
    window.addEventListener('message', handler);
    window.addEventListener('storage', storageHandler);
    setTimeout(() => {
        if (!resolved) cleanup();
    }, 60000);
}

function logout() {
    clearToken();
    shell = null;
    document.getElementById('app').innerHTML = '';
    window.location.hash = '#/login';
    show();
}

// ---------- 主题深浅（跟随前台，支持手动切换） ----------
function applyDark(dark) {
    document.documentElement.classList.toggle('dark', dark);
    const b = document.getElementById('theme-toggle');
    if (b) b.innerHTML = dark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

function resolvedDark() {
    const mode = localStorage.getItem('theme');
    return mode === 'dark' || (!mode && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

let themeWired = false;
function wireThemeEvents() {
    if (themeWired) return;
    themeWired = true;
    window.addEventListener('storage', (e) => {
        if (e.key === 'theme' || e.key === 'hue') syncTheme();
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (!localStorage.getItem('theme')) syncTheme();
    });
}

function syncTheme() {
    applyDark(resolvedDark());
    const hue = parseInt(localStorage.getItem('hue'), 10);
    if (hue >= 0 && hue <= 360) document.documentElement.style.setProperty('--hue', String(hue));
}

const NAV = [
    { group: '内容管理', items: [
        { path: '/dashboard', label: '仪表盘', icon: 'fa-chart-pie' },
        { path: '/posts', label: '文章管理', icon: 'fa-file-lines' }
    ]},
    { group: '站点模块', items: [
        { path: '/friends', label: '友链管理', icon: 'fa-link' }
    ]}
];

const TITLES = { '/dashboard': '仪表盘', '/posts': '文章管理', '/new': '新建文章', '/edit': '编辑文章', '/friends': '友链管理' };

function renderShell() {
    const app = document.getElementById('app');
    const groupsHtml = NAV.map((g) => `
        <div>
            <p class="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">${g.group}</p>
            <div class="space-y-1">
                ${g.items.map((it) => `<a href="#${it.path}" data-nav="${it.path}" class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
                    <i class="fas ${it.icon} h-[18px] w-[18px] text-center text-slate-400"></i><span>${it.label}</span>
                </a>`).join('')}
            </div>
        </div>`).join('');
    app.innerHTML = `
    <div class="flex min-h-screen bg-slate-50">
        <aside class="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-slate-200 bg-(--card-bg) lg:block">
            <div class="flex h-16 items-center gap-2.5 px-5">
                <img src="/favicon/firefly-32.png" alt="Firefly" class="h-8 w-8 shrink-0 rounded-lg" />
                <div class="leading-tight">
                    <p class="text-sm font-semibold text-slate-900">Firefly 后台</p>
                    <p class="text-[11px] text-slate-400">管理控制台</p>
                </div>
            </div>
            <nav class="space-y-5 overflow-y-auto px-3 py-2">${groupsHtml}</nav>
            <div class="border-t border-slate-200 p-3">
                <div class="rounded-lg bg-slate-50 p-3">
                    <p class="text-xs font-medium text-slate-700">写回仓库</p>
                    <p class="mt-1 text-[11px] leading-relaxed text-slate-500">${escapeHtml(store.owner ? `${store.owner}/${store.repo} · ${store.branch}` : '登录后自动读取')}</p>
                </div>
            </div>
        </aside>

        <div class="flex min-w-0 flex-1 flex-col lg:pl-60">
            <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-(--card-bg) px-4 backdrop-blur sm:px-6">
                <button id="hamburger" class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="打开菜单"><i class="fas fa-bars"></i></button>
                <h1 id="page-title" class="min-w-0 flex-1 truncate text-base font-semibold text-slate-900 sm:text-lg"></h1>
                <button id="theme-toggle" class="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-600 sm:inline-flex" aria-label="切换深浅模式"></button>
                <button id="preview-btn" class="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-600 sm:inline-flex" aria-label="预览前台" title="预览前台"><i class="fas fa-eye"></i></button>
                <div class="relative">
                    <button id="user-menu-btn" class="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-slate-100">
                        <img src="/favicon/firefly-32.png" alt="" class="h-8 w-8 rounded-full" />
                        <span class="hidden text-left leading-tight sm:block">
                            <span class="block text-sm font-medium text-slate-800">GitHub</span>
                            <span class="block text-[11px] text-slate-500">已授权</span>
                        </span>
                        <i class="fas fa-chevron-down text-slate-400"></i>
                    </button>
                    <div id="user-menu" class="absolute right-0 top-full z-40 mt-2 hidden w-44 overflow-hidden rounded-xl border border-slate-200 bg-(--card-bg) py-1 shadow-lg">
                        <button id="logout-btn" class="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50"><i class="fas fa-right-from-bracket"></i>退出登录</button>
                    </div>
                </div>
            </header>
            <main id="view" class="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6"></main>
        </div>
    </div>`;

    shell = {
        el: app,
        setActive(path) {
            app.querySelectorAll('[data-nav]').forEach((a) => {
                const act = a.dataset.nav === path;
                a.className = `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${act ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;
                const ic = a.querySelector('i');
                ic.className = `fas ${NAV.flatMap((g) => g.items).find((n) => n.path === a.dataset.nav).icon} text-center ${act ? 'text-brand-600' : 'text-slate-400'}`;
            });
            const title = TITLES[path] || 'Firefly 后台';
            app.querySelector('#page-title').textContent = title;
        },
        viewEl() {
            return app.querySelector('#view');
        }
    };

    app.querySelector('#hamburger').onclick = () => {
        const aside = app.querySelector('aside');
        aside.classList.toggle('hidden');
        aside.classList.toggle('lg:block');
    };
    const userBtn = app.querySelector('#user-menu-btn');
    const userMenu = app.querySelector('#user-menu');
    userBtn.onclick = () => userMenu.classList.toggle('hidden');
    document.addEventListener('mousedown', (e) => {
        if (!userBtn.contains(e.target) && !userMenu.contains(e.target)) userMenu.classList.add('hidden');
    });
    app.querySelector('#logout-btn').onclick = () => {
        userMenu.classList.add('hidden');
        logout();
    };
    applyDark(resolvedDark());
    app.querySelector('#theme-toggle').onclick = () => {
        localStorage.setItem('theme', resolvedDark() ? 'light' : 'dark');
        syncTheme();
    };
    app.querySelector('#preview-btn').onclick = openPreviewModal;
    wireThemeEvents();
}

// ---------- 前台主题预览 ----------
function openPreviewModal() {
    const wrap = openModal({
        title: '前台主题预览',
        body: '<iframe id="preview-iframe" src="/" class="h-[60vh] w-full rounded border-(--line-divider) bg-(--card-bg)"></iframe>',
        footer: '<button class="btn-secondary btn-sm" data-pf-close>关闭</button>'
    });
    const iframe = wrap.querySelector('#preview-iframe');
    const apply = () => {
        try {
            const root = iframe.contentDocument.documentElement;
            const h = document.documentElement.style.getPropertyValue('--hue')
                || getComputedStyle(document.documentElement).getPropertyValue('--hue');
            if (h) root.style.setProperty('--hue', h);
            root.classList.toggle('dark', document.documentElement.classList.contains('dark'));
        } catch {}
    };
    iframe.addEventListener('load', apply);
    const obs = new MutationObserver(apply);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    wrap.querySelector('[data-pf-close]').onclick = () => {
        obs.disconnect();
        closeModal();
    };
}

function parseRoute() {
    const raw = (window.location.hash || '#/dashboard').slice(1);
    const [pathPart, queryPart] = raw.split('?');
    const path = pathPart || '/dashboard';
    const params = new URLSearchParams(queryPart || '');
    return { path, params };
}

function showError(err) {
    const msg = (err && (err.stack || err.message)) || String(err);
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = `
    <div class="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div class="card max-w-2xl p-6">
            <p class="mb-2 text-sm font-semibold text-rose-600"><i class="fas fa-triangle-exclamation"></i> 后台初始化失败</p>
            <p class="mb-3 text-xs text-slate-500">请把下面信息反馈给维护者（或检查 /auth、/admin/config.yml 是否可访问）：</p>
            <pre class="max-h-80 overflow-auto rounded-lg bg-(--codeblock-bg) p-4 text-xs leading-relaxed text-(--codeblock-text)"></pre>
        </div>
    </div>`;
    app.querySelector('pre').textContent = msg;
}

window.addEventListener('error', (e) => showError(e.message || e.error));
window.addEventListener('unhandledrejection', (e) => showError(e.reason));

async function show() {
    try {
        const { path, params } = parseRoute();
        if (!store.token) {
            renderLoginView();
            return;
        }
        if (!shell) renderShell();
        if (!store.owner && !(await loadConfig())) {
            toast('配置加载失败，请检查 /admin/config.yml', 'error');
            clearToken();
            shell = null;
            renderLoginView();
            return;
        }
        const view = shell.viewEl();
        if (path === '/posts') renderPosts(view);
        else if (path === '/new') renderEditor(view, null);
        else if (path === '/edit') renderEditor(view, params.get('path'));
        else if (path === '/friends') renderFriends(view);
        else renderDashboard(view);
        shell.setActive(path === '/new' || path === '/edit' ? '/posts' : path);
    } catch (e) {
        console.error(e);
        showError(e);
    }
}

window.addEventListener('hashchange', () => show());
document.addEventListener('DOMContentLoaded', () => {
    try {
        loadToken();
        const params = new URLSearchParams(window.location.search);
        const tokenFromUrl = params.get('token');
        if (tokenFromUrl) {
            setToken(tokenFromUrl);
            history.replaceState({}, document.title, window.location.pathname);
        }
        show();
    } catch (e) {
        console.error(e);
        showError(e);
    }
});

export function handleLoginButton() {
    loginWithGithub(() => {
        show();
    });
}

export { show };
