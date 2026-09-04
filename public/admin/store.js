export const store = {
    token: '',
    owner: '',
    repo: '',
    branch: 'master',
    folder: 'src/content/posts'
};

const TOKEN_KEY = 'github_token';

export function loadToken() {
    store.token = localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
    store.token = token;
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
    store.token = '';
    localStorage.removeItem(TOKEN_KEY);
}

export async function loadConfig() {
    try {
        const res = await fetch('/admin/config.yml');
        if (!res.ok) throw new Error('无法获取配置');
        const cfg = jsyaml.load(await res.text());
        const repoFull = cfg.backend?.repo || cfg.repo;
        if (!repoFull) throw new Error('缺少 repo');
        const [owner, repo] = repoFull.split('/');
        store.owner = owner;
        store.repo = repo;
        store.branch = cfg.backend?.branch || cfg.branch || 'master';
        const col = (cfg.collections || []).find((c) => c.folder);
        if (col) store.folder = col.folder;
        return true;
    } catch (e) {
        console.error('配置加载失败', e);
        return false;
    }
}
