import { store } from '../store.js';
import { getFileContent, savePost, deletePost } from '../api.js';
import { buildFrontmatter, stringToBase64 } from '../utils.js';
import { badge, confirmDlg, toast } from '../ui.js';

export async function renderEditor(container, path = null) {
    const isNew = !path;
    const today = new Date().toISOString().slice(0, 10);
    const existing = isNew
        ? null
        : await getFileContent(store.owner, store.repo, store.branch, decodeURIComponent(path), store.token);
    if (!isNew && !existing) {
        toast('文章加载失败', 'error');
        window.location.hash = '#/posts';
        return;
    }
    window._sha = existing ? existing.sha : '';

    container.innerHTML = `
    <div class="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <div class="space-y-5">
            <div class="card space-y-4 p-5">
                <p class="text-sm font-semibold text-slate-800">基础信息</p>
                <div class="grid gap-4 sm:grid-cols-2">
                    <div class="sm:col-span-2">
                        <label class="label">标题 <span class="text-rose-500">*</span></label>
                        <input id="e-title" class="field" placeholder="文章标题" />
                    </div>
                    <div>
                        <label class="label">文件路径 <span class="text-rose-500">*</span></label>
                        <input id="e-path" class="field font-mono text-[13px]" placeholder="${store.folder}/xxx.md" />
                    </div>
                    <div>
                        <label class="label">作者</label>
                        <input id="e-author" class="field" placeholder="可选" />
                    </div>
                    <div class="sm:col-span-2">
                        <label class="label">描述</label>
                        <textarea id="e-desc" class="field" rows="2" placeholder="显示在首页文章卡片上的简短描述"></textarea>
                    </div>
                </div>
            </div>
            <div class="card space-y-4 p-5">
                <p class="text-sm font-semibold text-slate-800">正文 (Markdown)</p>
                <textarea id="e-content" rows="16"></textarea>
            </div>
        </div>
        <aside class="space-y-4">
            <div class="card space-y-4 p-5">
                <p class="text-sm font-semibold text-slate-800">发布</p>
                <label class="flex items-center gap-3"><input type="radio" name="e-draft" value="false" checked class="text-brand-600" />已发布</label>
                <label class="flex items-center gap-3"><input type="radio" name="e-draft" value="true" class="text-brand-600" />草稿</label>
                <div class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span class="text-sm text-slate-600">置顶</span>
                    <input id="e-pinned" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-600" />
                </div>
                <div class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span class="text-sm text-slate-600">允许评论</span>
                    <input id="e-comment" type="checkbox" checked class="h-4 w-4 rounded border-slate-300 text-brand-600" />
                </div>
            </div>
            <div class="card space-y-4 p-5">
                <p class="text-sm font-semibold text-slate-800">元数据</p>
                <div><label class="label">发布日期</label><input id="e-published" type="date" class="field" value="${today}" /></div>
                <div><label class="label">更新日期</label><input id="e-updated" type="date" class="field" /></div>
                <div><label class="label">标签</label><input id="e-tags" class="field" placeholder="逗号分隔" /></div>
                <div><label class="label">分类</label><input id="e-category" class="field" /></div>
                <div><label class="label">封面图片</label><input id="e-image" class="field font-mono text-[13px]" placeholder="https:// 或 /path/to/img" /></div>
                <div><label class="label">文章来源</label><input id="e-source" class="field" placeholder="https://" /></div>
                <div><label class="label">密码保护</label><input id="e-password" class="field" placeholder="可选" /></div>
            </div>
            <div class="card space-y-3 p-5">
                <button id="e-save" class="btn-primary w-full justify-center"><i class="fas fa-floppy-disk"></i>保存</button>
                <button id="e-delete" class="btn-danger w-full justify-center" ${isNew ? 'disabled' : ''}><i class="fas fa-trash-can"></i>删除</button>
                <a href="#/posts" class="btn-secondary w-full justify-center">返回列表</a>
            </div>
            <div id="e-note"></div>
        </aside>
    </div>`;

    if (isNew) {
        set('#e-path', `${store.folder}/${today}-new-post.md`);
    } else {
        set('#e-title', existing.title);
        set('#e-path', existing.path);
        set('#e-desc', existing.description);
        set('#e-tags', Array.isArray(existing.tags) ? existing.tags.join(', ') : (existing.tags || ''));
        set('#e-category', existing.category);
        set('#e-image', existing.image);
        set('#e-source', existing.sourceLink);
        set('#e-password', existing.password);
        set('#e-author', existing.author);
        if (existing.published) document.getElementById('e-published').value = String(existing.published).slice(0, 10);
        if (existing.updated) document.getElementById('e-updated').value = String(existing.updated).slice(0, 10);
        document.getElementById('e-pinned').checked = !!existing.pinned;
        document.getElementById('e-comment').checked = existing.comment !== false;
        const dr = document.querySelector(`input[name="e-draft"][value="${existing.draft}"]`);
        if (dr) dr.checked = true;
        document.getElementById('e-note').innerHTML = badge('slate', '编辑会保留其余 frontmatter 字段');
    }

    const ta = document.getElementById('e-content');
    const simplemde = new SimpleMDE({
        element: ta,
        spellChecker: false,
        status: ['lines', 'words'],
        toolbar: ['bold', 'italic', 'heading', '|', 'quote', 'unordered-list', 'ordered-list', '|', 'link', 'image', 'code', 'table', '|', 'preview', 'side-by-side', 'fullscreen']
    });
    if (existing) simplemde.value(existing.content || '');

    document.getElementById('e-save').onclick = async () => {
        const title = document.getElementById('e-title').value.trim();
        const filePath = document.getElementById('e-path').value.trim();
        if (!title) {
            toast('请填写标题', 'error');
            return;
        }
        if (!filePath || !filePath.startsWith(store.folder)) {
            toast(`文件路径必须以 ${store.folder} 开头`, 'error');
            return;
        }
        if (!/\.(md|mdx)$/i.test(filePath)) {
            toast('扩展名必须是 .md 或 .mdx', 'error');
            return;
        }
        const draft = (document.querySelector('input[name="e-draft"]:checked') || {}).value === 'true';
        const finalContent = buildFrontmatter(
            simplemde.value(), title, draft,
            document.getElementById('e-desc').value.trim(),
            document.getElementById('e-tags').value.trim(),
            document.getElementById('e-category').value.trim(),
            document.getElementById('e-image').value.trim(),
            document.getElementById('e-published').value,
            document.getElementById('e-updated').value,
            document.getElementById('e-pinned').checked,
            document.getElementById('e-comment').checked,
            document.getElementById('e-author').value.trim(),
            document.getElementById('e-source').value.trim(),
            document.getElementById('e-password').value.trim()
        );
        const btn = document.getElementById('e-save');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>保存中…';
        const res = await savePost(store.owner, store.repo, store.branch, filePath, stringToBase64(finalContent), window._sha || '', store.token);
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-floppy-disk"></i>保存';
        if (res.ok) {
            toast('保存成功，已提交仓库');
            window.location.hash = '#/posts';
        } else {
            const err = await res.json().catch(() => ({}));
            toast(`保存失败: ${err.message || res.status}`, 'error');
        }
    };

    document.getElementById('e-delete').onclick = async () => {
        const fp = document.getElementById('e-path').value.trim();
        const sha = window._sha || '';
        if (!fp || !sha) return;
        const ok = await confirmDlg({ title: '删除文章', message: `确认删除 ${fp}？删除将直接提交仓库。` });
        if (!ok) return;
        const res = await deletePost(store.owner, store.repo, store.branch, fp, sha, store.token);
        if (res.ok) {
            toast('文章已删除');
            window.location.hash = '#/posts';
        } else {
            const err = await res.json().catch(() => ({}));
            toast(`删除失败: ${err.message || res.status}`, 'error');
        }
    };
}

function set(sel, val) {
    const el = document.querySelector(sel);
    if (el) el.value = val || '';
}
