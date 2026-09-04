import { escapeHtml } from './utils.js';

const TONE = {
    slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
    blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    rose: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
    cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20'
};

// GitHub 官方品牌图标（内联 SVG，不依赖 FA 字体）
const GITHUB_PATH = 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12';

export function githubIcon(size = '1em') {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true" style="display:inline-block;vertical-align:-0.125em"><path d="${GITHUB_PATH}"/></svg>`;
}

export function badge(tone, text) {
    return `<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE[tone] || TONE.slate}">${escapeHtml(text)}</span>`;
}

export function toast(message, type = 'success') {
    const cls = type === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : type === 'error'
            ? 'border-rose-200 bg-rose-50 text-rose-800'
            : 'border-slate-200 bg-(--card-bg) text-slate-700';
    const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = `pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border px-4 py-3 text-sm shadow-lg ${cls}`;
    el.innerHTML = `<i class="fas ${icon} mt-0.5"></i><span class="flex-1"></span><button class="text-slate-400 hover:text-slate-600"><i class="fas fa-xmark"></i></button>`;
    el.querySelector('span').textContent = message;
    el.querySelector('button').onclick = () => el.remove();
    root.appendChild(el);
    setTimeout(() => el.remove(), 3200);
}

export function openModal({ title, body, footer, onClose }) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
            <div class="absolute inset-0 bg-(--overlay) backdrop-blur-[2px]" data-close></div>
            <div class="relative z-10 w-full max-w-lg rounded-t-2xl bg-(--card-bg) shadow-xl sm:rounded-xl">
                <div class="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                    <h3 class="text-base font-semibold text-slate-900">${escapeHtml(title)}</h3>
                    <button data-close class="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><i class="fas fa-xmark"></i></button>
                </div>
                <div class="max-h-[70vh] overflow-y-auto px-5 py-4"></div>
                <div class="flex justify-end gap-2 border-t border-slate-200 px-5 py-3"></div>
            </div>
        </div>`;
    const wrap = root.firstElementChild;
    wrap.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closeModal));
    const close = onClose || (() => {});
    wrap.querySelector('div.relative > div:nth-child(2)').innerHTML = body;
    wrap.querySelector('div.relative > div:last-child').innerHTML = footer || '';
    return wrap;
}

export function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
}

export function confirmDlg({ title, message, confirmText = '确认删除', danger = true }) {
    return new Promise((resolve) => {
        const wrap = openModal({
            title,
            body: `<div class="flex gap-3">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${danger ? 'bg-rose-50 text-rose-600' : 'bg-brand-50 text-brand-600'}"><i class="fas fa-triangle-exclamation"></i></span>
                <p class="text-sm leading-relaxed text-slate-600"></p>
            </div>`,
            footer: `
                <button class="btn-secondary btn-sm" data-act="cancel">取消</button>
                <button class="btn-sm ${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">${escapeHtml(confirmText)}</button>`
        });
        wrap.querySelector('p').textContent = message;
        let done = false;
        const finish = (v) => {
            if (done) return;
            done = true;
            closeModal();
            resolve(v);
        };
        wrap.querySelector('[data-act="cancel"]').onclick = () => finish(false);
        wrap.querySelector('[data-act="ok"]').onclick = () => finish(true);
        wrap.querySelector('[data-close]')?.addEventListener('click', () => finish(false));
    });
}

export function statCard(label, value, icon, tone = 'text-brand-600') {
    return `
        <div class="card p-4">
            <div class="flex items-start justify-between">
                <div>
                    <p class="text-2xl font-bold text-slate-900">${value}</p>
                    <p class="mt-0.5 text-xs text-slate-500">${escapeHtml(label)}</p>
                </div>
                <span class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 ${tone}"><i class="fas ${icon}"></i></span>
            </div>
        </div>`;
}

export function emptyState(title, description = '', icon = 'fa-inbox') {
    return `
        <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><i class="fas ${icon} text-lg"></i></span>
            <p class="text-sm font-medium text-slate-800">${escapeHtml(title)}</p>
            ${description ? `<p class="mt-1 max-w-sm text-sm text-slate-500">${escapeHtml(description)}</p>` : ''}
        </div>`;
}

export function iconBtnHtml(icon, title, variant = 'card') {
    const cls = {
        card: 'border bg-(--card-bg) text-slate-500 shadow-sm border-slate-200 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600',
        ghost: 'border border-transparent bg-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-600',
        danger: 'border bg-(--card-bg) text-slate-500 shadow-sm border-slate-200 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600'
    }[variant];
    return `<button type="button" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" class="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all ${cls}"><i class="fas ${icon} text-sm"></i></button>`;
}
