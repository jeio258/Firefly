import { store } from '../store.js';
import { escapeHtml } from '../utils.js';
import { githubIcon } from '../ui.js';

export function renderLoginView() {
    const app = document.getElementById('app');
    app.innerHTML = `
    <div class="flex min-h-screen bg-slate-50">
        <div class="relative hidden flex-1 overflow-hidden bg-brand-700 lg:flex lg:items-center lg:justify-center">
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.18),transparent_45%)]"></div>
            <div class="relative max-w-md px-10 text-white">
                <div class="mb-8 flex items-center gap-3">
                    <img src="/favicon/firefly-32.png" alt="Firefly" class="h-11 w-11 rounded-xl" />
                    <div>
                        <p class="text-lg font-semibold">Firefly 后台</p>
                        <p class="text-sm text-brand-100">Firefly Admin Console</p>
                    </div>
                </div>
                <h2 class="text-3xl font-bold leading-snug">内容与友链，写回 GitHub 仓库。</h2>
                <ul class="mt-8 space-y-3 text-sm text-brand-100">
                    <li class="flex gap-2.5"><span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-200"></span>GitHub 授权登录，凭据仅存本机浏览器</li>
                    <li class="flex gap-2.5"><span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-200"></span>文章 frontmatter 与友链申请直接在仓库内维护</li>
                </ul>
            </div>
        </div>
        <div class="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
            <div class="w-full max-w-sm">
                <h2 class="text-2xl font-bold text-slate-900">登录</h2>
                <p class="mt-1.5 text-sm text-slate-500">使用 GitHub 账号进入管理后台</p>
                <div class="mt-7">
                    <button id="login-btn" class="btn-primary w-full justify-center py-2.5">${githubIcon('1.05em')} 使用 GitHub 登录</button>
                </div>
                <p class="mt-6 text-center text-xs leading-relaxed text-slate-400">登录后改动将直接提交到 ${escapeHtml(store.owner ? `${store.owner}/${store.repo}@${store.branch}` : '配置中的仓库')}</p>
            </div>
        </div>
    </div>`;
    document.getElementById('login-btn').onclick = async () => {
        const { handleLoginButton } = await import('../main.js');
        handleLoginButton();
    };
}
