import { store } from '../store.js';
import { getAllPostFiles, getFileContent, deletePost } from '../api.js';
import { escapeHtml, escapeAttr } from '../utils.js';
import { badge, emptyState, iconBtnHtml, confirmDlg, toast } from '../ui.js';

export async function renderPosts(container) {
    container.innerHTML = `
    <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-3">
            <input id="post-search" class="field max-w-xs" placeholder="搜索标题 / slug" />
            <span id="post-count" class="text-xs text-slate-400"></span>
            <div class="ml-auto flex items-center gap-2">
                <button id="post-refresh" class="btn-secondary btn-sm"><i class="fas fa-rotate-right"></i>刷新</button>
                <a href="#/new" class="btn-primary btn-sm"><i class="fas fa-plus"></i>新建文章</a>
            </div>
        </div>
        <div id="post-box" class="card"><div class="flex justify-center p-10 text-slate-400"><i class="fas fa-circle-notch fa-spin"></i></div></div>
    </div>`;

    let all = [];
    const box = document.getElementById('post-box');
    const search = document.getElementById('post-search');

    async function load() {
        try {
            const files = await getAllPostFiles(store.owner, store.repo, store.branch, store.folder, store.token);
            const items = await Promise.allSettled(files.map((f) => getFileContent(store.owner, store.repo, store.branch, f.path, store.token)));
            all = files.map((f, i) =>
                items[i].status === 'fulfilled' && items[i].value
                    ? items[i].value
                    : { path: f.path, sha: f.sha, title: f.name.replace(/\.(md|mdx)$/i, ''), draft: false }
            );
            all.sort((a, b) => String(a.path).localeCompare(String(b.path)));
            render();
        } catch (e) {
            box.innerHTML = emptyState('加载失败', e.message || String(e), 'fa-triangle-exclamation');
        }
    }

    function render() {
        const kw = search.value.trim().toLowerCase();
        const list = all.filter((p) => !kw || `${p.title} ${p.path}`.toLowerCase().includes(kw));
        document.getElementById('post-count').textContent = `共 ${list.length} 篇`;
        if (list.length === 0) {
            box.innerHTML = emptyState('没有匹配的文章', '试试调整搜索词或新建文章');
            return;
        }
        box.innerHTML = `
        <div class="hidden overflow-x-auto sm:block">
            <table class="w-full text-left text-sm">
                <thead><tr class="border-b border-slate-100 text-xs text-slate-400">
                    <th class="px-4 py-2.5 font-medium">标题</th>
                    <th class="px-2 py-2.5 font-medium">分类 / 标签</th>
                    <th class="px-2 py-2.5 font-medium">状态</th>
                    <th class="w-24 px-4 py-2.5 text-right font-medium">操作</th>
                </tr></thead>
                <tbody>${list.map((p) => `
                    <tr class="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td class="px-4 py-2.5">
                            <button class="block max-w-[24rem] truncate text-left font-medium text-slate-800 hover:text-brand-600" data-open="${escapeAttr(p.path)}">${escapeHtml(p.title)}</button>
                            <span class="block max-w-[24rem] truncate font-mono text-[11px] text-slate-400">${escapeHtml(p.path.replace(store.folder + '/', ''))}</span>
                        </td>
                        <td class="px-2 py-2.5">
                            ${p.category ? badge('blue', p.category) : ''}
                            ${(Array.isArray(p.tags) ? p.tags.slice(0, 2) : []).map((t) => `<span class="ml-1">${badge('emerald', t)}</span>`).join('')}
                        </td>
                        <td class="px-2 py-2.5">${p.draft ? badge('amber', '草稿') : badge('emerald', '已发布')}</td>
                        <td class="px-4 py-2.5"><div class="flex justify-end gap-1">
                            ${iconBtnHtml('fa-pen', '编辑')}${iconBtnHtml('fa-trash-can', '删除', 'danger')}
                        </div></td>
                    </tr>`).join('')}</tbody>
            </table>
        </div>
        <div id="post-cards" class="divide-y divide-slate-100 sm:hidden">
            ${list.map((p) => `
                <div class="px-4 py-3">
                    <div class="flex items-start justify-between gap-2">
                        <button class="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-800 hover:text-brand-600" data-open="${escapeAttr(p.path)}">${escapeHtml(p.title)}</button>
                        ${p.draft ? badge('amber', '草稿') : badge('emerald', '已发布')}
                    </div>
                    <p class="mt-1 truncate font-mono text-[11px] text-slate-400">${escapeHtml(p.path.replace(store.folder + '/', ''))}</p>
                    <div class="mt-2 flex items-center justify-between gap-2">
                        <div class="flex min-w-0 flex-wrap gap-1">
                            ${p.category ? badge('blue', p.category) : ''}
                            ${(Array.isArray(p.tags) ? p.tags.slice(0, 2) : []).map((t) => badge('emerald', t)).join('')}
                        </div>
                        <div class="flex shrink-0 gap-1">${iconBtnHtml('fa-pen', '编辑')}${iconBtnHtml('fa-trash-can', '删除', 'danger')}</div>
                    </div>
                </div>`).join('')}
        </div>`;

        box.querySelectorAll('[data-open]').forEach((b) => {
            b.onclick = () => (window.location.hash = `#/edit?path=${encodeURIComponent(b.dataset.open)}`);
        });
        const bindRow = (btn, item, isDel) => {
            btn.onclick = async () => {
                if (!isDel) { window.location.hash = `#/edit?path=${encodeURIComponent(item.path)}`; return; }
                const ok = await confirmDlg({ title: '删除文章', message: `确认删除「${item.title}」（${item.path}）？删除将直接提交仓库。`, confirmText: '确认删除' });
                if (!ok) return;
                if (!item.sha) { toast('该文件尚未读取到 sha，请刷新后重试', 'error'); return; }
                const res = await deletePost(store.owner, store.repo, store.branch, item.path, item.sha, store.token);
                if (res.ok) { toast('文章已删除'); await load(); }
                else { const err = await res.json().catch(() => ({})); toast(`删除失败: ${err.message || res.status}`, 'error'); }
            };
        };
        let ti = 0;
        box.querySelectorAll('tbody tr').forEach((tr) => {
            const item = list[ti++];
            bindRow(tr.querySelector('button[aria-label="编辑"]'), item, false);
            bindRow(tr.querySelector('button[aria-label="删除"]'), item, true);
        });
        let ci = 0;
        box.querySelectorAll('#post-cards > div').forEach((el) => {
            const item = list[ci++];
            bindRow(el.querySelector('button[aria-label="编辑"]'), item, false);
            bindRow(el.querySelector('button[aria-label="删除"]'), item, true);
        });
    }

    document.getElementById('post-refresh').onclick = () => load();
    search.addEventListener('input', render);
    await load();
}
