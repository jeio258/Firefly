// main.js：后台应用入口（布局壳 / 路由 / OAuth）
import { store, loadToken, setToken, clearToken, loadConfig } from './store.js';
import { toast } from './ui.js';
import { renderLoginView } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderPosts } from './views/posts.js';
import { renderEditor } from './views/editor.js';
import { renderFriends } from './views/friends.js';

let shell = null;      // 登录后一次性渲染的应用壳
let drawerOpen = false;

// ---------- OAuth（协议与旧后台一致，勿改） ----------
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

// ---------- 布局壳（对齐 cms-admin：左 240 侧栏 + sticky 顶栏） ----------
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
        <aside class="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-slate-200 bg-white lg:block">
            <div class="flex h-16 items-center gap-2.5 px-5">
                <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">F</span>
                <div class="leading-tight">
                    <p class="text-sm font-semibold text-slate-900">Firefly 后台</p>
                    <p class="text-[11px] text-slate-400">管理控制台</p>
                </div>
            </div>
            <nav class="space-y-5 overflow-y-auto px-3 py-2">${groupsHtml}</nav>
            <div class="border-t border-slate-200 p-3">
                <div class="rounded-lg bg-slate-50 p-3">
                    <p class="text-xs font-medium text-slate-700">写回仓库</p>
                    <p class="mt-1 text-[11px] leading-relaxed text-slate-500">${escapeText(store.owner ? `${store.owner}/${store.repo} · ${store.branch}` : '登录后自动读取')}</p>
                </div>
            </div>
        </aside>

        <div class="flex min-w-0 flex-1 flex-col lg:pl-60">
            <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
                <button id="hamburger" class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="打开菜单"><i class="fas fa-bars"></i></button>
                <h1 id="page-title" class="min-w-0 flex-1 truncate text-base font-semibold text-slate-900 sm:text-lg"></h1>
                <div class="relative">
                    <button id="user-menu-btn" class="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-slate-100">
                        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">GH</span>
                        <span class="hidden text-left leading-tight sm:block">
                            <span class="block text-sm font-medium text-slate-800">GitHub</span>
                            <span class="block text-[11px] text-slate-500">已授权</span>
                        </span>
                        <i class="fas fa-chevron-down text-slate-400"></i>
                    </button>
                    <div id="user-menu" class="absolute right-0 top-full z-40 mt-2 hidden w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
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
}

function escapeText(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// ---------- 路由 ----------
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
            <pre class="max-h-80 overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100"></pre>
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
