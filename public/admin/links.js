// links.js：友链 YAML 数据层（纯数据，UI 在 views/friends.js）
import { stringToBase64, base64ToString } from './utils.js';
import { store } from './store.js';

const FRIENDS_PATH = 'public/data/friends.yaml';
const REQUESTS_PATH = 'public/data/friend_requests.yaml';

function apiUrl(path) {
    return `https://api.github.com/repos/${store.owner}/${store.repo}/contents/${path}?ref=${store.branch}`;
}

// ---------- 数据获取 ----------
export async function getFriendRequests() {
    try {
        const res = await fetch(apiUrl(REQUESTS_PATH), { headers: { Authorization: `token ${store.token}` } });
        if (!res.ok) return { sha: null, data: [] };
        const file = await res.json();
        return { sha: file.sha, data: jsyaml.load(base64ToString(file.content)) || [] };
    } catch (err) {
        console.error('获取友链请求失败:', err);
        return { sha: null, data: [] };
    }
}

export async function getFriends() {
    try {
        const res = await fetch(apiUrl(FRIENDS_PATH), { headers: { Authorization: `token ${store.token}` } });
        if (!res.ok) return { sha: null, data: [] };
        const file = await res.json();
        return { sha: file.sha, data: jsyaml.load(base64ToString(file.content)) || [] };
    } catch (err) {
        console.error('获取友链列表失败:', err);
        return { sha: null, data: [] };
    }
}

// ---------- 文件更新 ----------
async function updateFile(path, content, sha, message) {
    const res = await fetch(apiUrl(path), {
        method: 'PUT',
        headers: {
            Authorization: `token ${store.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message, content: stringToBase64(jsyaml.dump(content)), branch: store.branch, sha })
    });
    return res;
}

// 自动重试一次，解决 409 冲突
async function updateFileWithRetry(path, newContent, initialSha, message) {
    let sha = initialSha;
    for (let attempt = 0; attempt < 2; attempt++) {
        const res = await updateFile(path, newContent, sha, message);
        if (res.ok) return true;
        if (res.status === 409 && attempt === 0) {
            const getRes = await fetch(apiUrl(path), { headers: { Authorization: `token ${store.token}` } });
            if (getRes.ok) {
                const file = await getRes.json();
                sha = file.sha;
                continue;
            }
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(`GitHub API ${res.status} (${path}): ${errData.message || res.statusText}`);
    }
    return false;
}

function triggerHook() {
    if (window.NETLIFY_HOOK) {
        fetch(window.NETLIFY_HOOK, { method: 'POST' }).catch(() => {});
    }
}

// ---------- 审核批准 ----------
export async function approveRequest(index) {
    const reqRes = await getFriendRequests();
    const friendRes = await getFriends();
    const request = reqRes.data[index];
    if (!request) return false;
    const newRequests = reqRes.data.filter((_, i) => i !== index);
    const newFriends = [...friendRes.data, { ...request, enabled: true }];
    try {
        await Promise.all([
            updateFileWithRetry(REQUESTS_PATH, newRequests, reqRes.sha, `审核通过: ${request.title}`),
            updateFileWithRetry(FRIENDS_PATH, newFriends, friendRes.sha, `新增友链: ${request.title}`)
        ]);
        triggerHook();
        return true;
    } catch (e) {
        console.error('批准失败:', e);
        return false;
    }
}

// ---------- 审核拒绝 ----------
export async function rejectRequest(index) {
    const { sha, data } = await getFriendRequests();
    const newData = data.filter((_, i) => i !== index);
    try {
        await updateFileWithRetry(REQUESTS_PATH, newData, sha, '拒绝友链申请');
        return true;
    } catch (e) {
        console.error('拒绝失败:', e);
        return false;
    }
}

// ---------- 已通过友链修改/删除 ----------
export async function updateFriend(index, updatedData) {
    const { sha, data } = await getFriends();
    if (index < 0 || index >= data.length) return false;
    const newData = [...data];
    newData[index] = { ...newData[index], ...updatedData };
    try {
        await updateFileWithRetry(FRIENDS_PATH, newData, sha, `更新友链: ${updatedData.title}`);
        triggerHook();
        return true;
    } catch (e) {
        console.error('更新失败:', e);
        return false;
    }
}

export async function deleteFriend(index) {
    const { sha, data } = await getFriends();
    if (index < 0 || index >= data.length) return false;
    const newData = data.filter((_, i) => i !== index);
    try {
        await updateFileWithRetry(FRIENDS_PATH, newData, sha, '删除友链');
        triggerHook();
        return true;
    } catch (e) {
        console.error('删除失败:', e);
        return false;
    }
}
