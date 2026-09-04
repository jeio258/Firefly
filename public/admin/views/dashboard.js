import { store } from '../store.js';
import { getAllPostFiles } from '../api.js';
import { getFriendRequests, getFriends } from '../links.js';
import { statCard, emptyState, badge } from '../ui.js';

export async function renderDashboard(container) {
    container.innerHTML = `<p class="text-sm text-slate-500">正在读取仓库…</p>`;
    try {
        const [posts, reqs, friends] = await Promise.all([
            getAllPostFiles(store.owner, store.repo, store.branch, store.folder, store.token).catch(() => []),
            getFriendRequests(),
            getFriends()
        ]);
        container.innerHTML = `
        <div class="space-y-5">
            <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
                ${statCard('文章总数', posts.length, 'fa-file-lines', 'text-brand-600')}
                ${statCard('待审核申请', (reqs.data || []).length, 'fa-envelope-open-text', 'text-amber-600')}
                ${statCard('已通过友链', (friends.data || []).length, 'fa-link', 'text-emerald-600')}
                ${statCard('目标仓库', '', 'fa-git-alt', 'text-slate-500')}
            </div>
            <div class="card flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div class="flex flex-wrap items-center gap-2 text-slate-600">
                    <i class="fas fa-cloud-arrow-up text-brand-500"></i>
                    <span>写回目标</span>
                    ${badge('slate', `${store.owner}/${store.repo}@${store.branch}`)}
                </div>
                <div class="flex flex-wrap gap-2">
                    <a href="#/posts" class="btn-secondary btn-sm">文章管理</a>
                    <a href="#/friends" class="btn-secondary btn-sm">友链审核</a>
                </div>
            </div>
        </div>`;
    } catch (e) {
        container.innerHTML = emptyState('读取失败', e.message || String(e), 'fa-triangle-exclamation');
    }
}
