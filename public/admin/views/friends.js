// views/friends.js：友链审核（待审批准/拒绝 + 已通过编辑/删除）
import { getFriendRequests, getFriends, approveRequest, rejectRequest, updateFriend, deleteFriend } from '../links.js';
import { badge, confirmDlg, emptyState, openModal, closeModal, toast } from '../ui.js';

export async function renderFriends(container) {
    container.innerHTML = `
    <div class="space-y-5">
        <div class="flex items-center justify-between">
            <p class="text-sm text-slate-500">申请与友链写入 public/data/*.yaml</p>
            <button id="fr-refresh" class="btn-secondary btn-sm"><i class="fas fa-rotate-right"></i>刷新</button>
        </div>
        <div class="card p-5">
            <p class="mb-3 text-sm font-semibold text-slate-800">待审核申请</p>
            <div id="fr-review"></div>
        </div>
        <div class="card p-5">
            <p class="mb-3 text-sm font-semibold text-slate-800">已通过友链</p>
            <div id="fr-approved"></div>
        </div>
    </div>`;

    document.getElementById('fr-refresh').onclick = () => load();
    await load();

    async function load() {
        renderReview();
        renderApproved();
    }

    async function renderReview() {
        const box = document.getElementById('fr-review');
        box.innerHTML = `<p class="py-4 text-center text-sm text-slate-400"><i class="fas fa-circle-notch fa-spin"></i></p>`;
        const { data: requests } = await getFriendRequests();
        if (!requests || requests.length === 0) {
            box.innerHTML = emptyState('暂无待审核申请');
            return;
        }
        box.innerHTML = requests.map((req, i) => `
        <div class="flex items-start gap-4 rounded-lg border border-slate-200 p-4">
            <img src="${escapeAttr(req.imgurl || '')}" onerror="this.style.visibility='hidden'" class="h-10 w-10 shrink-0 rounded-full object-cover" alt="" />
            <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-slate-800">${escapeText(req.title)}</p>
                <a href="${escapeAttr(req.siteurl || '#')}" target="_blank" rel="noopener" class="block truncate text-xs text-brand-600">${escapeText(req.siteurl || '')}</a>
                <p class="mt-1 text-xs text-slate-500">${escapeText(req.desc || '')}</p>
                <div class="mt-1 flex flex-wrap gap-1">${(req.tags || []).map((t) => badge('emerald', t)).join('')}</div>
            </div>
            <div class="flex shrink-0 gap-2">
                <button class="btn-primary btn-sm" data-approve="${i}">批准</button>
                <button class="btn-secondary btn-sm text-rose-600 hover:text-rose-700" data-reject="${i}">拒绝</button>
            </div>
        </div>`).join('');

        box.querySelectorAll('[data-approve]').forEach(async (btn) => {
            btn.onclick = async () => {
                const idx = Number(btn.dataset.approve);
                const ok = await confirmDlg({ title: '批准友链', message: `确认批准「${requests[idx]?.title}」？`, confirmText: '确认批准', danger: false });
                if (!ok) return;
                btn.disabled = true;
                if (await approveRequest(idx)) {
                    toast('已批准并提交仓库');
                    load();
                } else {
                    btn.disabled = false;
                    toast('批准失败', 'error');
                }
            };
        });
        box.querySelectorAll('[data-reject]').forEach((btn) => {
            btn.onclick = async () => {
                const idx = Number(btn.dataset.reject);
                const ok = await confirmDlg({ title: '拒绝申请', message: `确认拒绝「${requests[idx]?.title}」的申请？` });
                if (!ok) return;
                btn.disabled = true;
                if (await rejectRequest(idx)) {
                    toast('已拒绝');
                    load();
                } else {
                    btn.disabled = false;
                    toast('拒绝失败', 'error');
                }
            };
        });
    }

    async function renderApproved() {
        const box = document.getElementById('fr-approved');
        box.innerHTML = `<p class="py-4 text-center text-sm text-slate-400"><i class="fas fa-circle-notch fa-spin"></i></p>`;
        const { data: friends } = await getFriends();
        if (!friends || friends.length === 0) {
            box.innerHTML = emptyState('暂无已通过友链');
            return;
        }
        box.innerHTML = `<div class="grid gap-3 lg:grid-cols-2">` + friends.map((f, i) => `
        <div class="flex items-center gap-4 rounded-lg border border-slate-200 p-4">
            <img src="${escapeAttr(f.imgurl || '')}" onerror="this.style.visibility='hidden'" class="h-10 w-10 shrink-0 rounded-full object-cover" alt="" />
            <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-slate-800">${escapeText(f.title)}</p>
                <p class="truncate text-xs text-slate-400">${escapeText(f.siteurl || '')}</p>
            </div>
            <div class="flex shrink-0 gap-1.5">
                <button class="btn-secondary btn-sm" data-edit="${i}">编辑</button>
                <button class="btn-secondary btn-sm text-rose-600 hover:text-rose-700" data-del="${i}">删除</button>
            </div>
        </div>`).join('') + `</div>`;

        box.querySelectorAll('[data-edit]').forEach((btn) => {
            btn.onclick = () => openEditModal(friends, Number(btn.dataset.edit), () => load());
        });
        box.querySelectorAll('[data-del]').forEach(async (btn) => {
            btn.onclick = async () => {
                const idx = Number(btn.dataset.del);
                const ok = await confirmDlg({ title: '删除友链', message: `确认删除「${friends[idx]?.title}」？` });
                if (!ok) return;
                btn.disabled = true;
                if (await deleteFriend(idx)) {
                    toast('已删除');
                    load();
                } else {
                    btn.disabled = false;
                    toast('删除失败', 'error');
                }
            };
        });
    }
}

function openEditModal(friends, index, onSuccess) {
    const f = friends[index];
    const wrap = openModal({
        title: '编辑友链',
        body: `
            <div class="space-y-4">
                <div><label class="label">标题</label><input id="ef-title" class="field" value="${escapeAttr(f.title || '')}" /></div>
                <div><label class="label">网址</label><input id="ef-url" class="field" value="${escapeAttr(f.siteurl || '')}" /></div>
                <div><label class="label">头像</label><input id="ef-img" class="field" value="${escapeAttr(f.imgurl || '')}" /></div>
                <div><label class="label">描述</label><textarea id="ef-desc" class="field" rows="2">${escapeText(f.desc || '')}</textarea></div>
                <div><label class="label">标签（逗号分隔）</label><input id="ef-tags" class="field" value="${escapeAttr((f.tags || []).join(', '))}" /></div>
                <div><label class="label">权重</label><input id="ef-weight" type="number" class="field" value="${f.weight ?? 0}" /></div>
            </div>`,
        footer: `
            <button class="btn-secondary btn-sm" data-ef-cancel>取消</button>
            <button class="btn-primary btn-sm" data-ef-save>保存</button>`
    });
    wrap.querySelector('[data-ef-cancel]').onclick = closeModal;
    wrap.querySelector('[data-ef-save]').onclick = async () => {
        const g = (id) => document.getElementById(id);
        const title = g('ef-title').value.trim();
        const siteurl = g('ef-url').value.trim();
        const imgurl = g('ef-img').value.trim();
        const desc = g('ef-desc').value.trim();
        const tagsStr = g('ef-tags').value.trim();
        const tags = tagsStr ? tagsStr.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : [];
        if (!title || !siteurl) {
            toast('标题与网址必填', 'error');
            return;
        }
        const weight = Number(g('ef-weight').value) || 0;
        const ok = await updateFriend(index, { title, siteurl, imgurl, desc, tags, weight });
        if (ok) {
            closeModal();
            toast('友链已更新');
            onSuccess();
        } else {
            toast('更新失败', 'error');
        }
    };
}

function escapeText(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
}
function escapeAttr(s) {
    return escapeText(s).replace(/"/g, '&quot;');
}
