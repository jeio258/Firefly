export function stringToBase64(str) {
    return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}

export function base64ToString(b64) {
    return new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
}

export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
}

// 输出 frontmatter 字段顺序与日期去引号须对齐旧后台
export function buildFrontmatter(content, title, draft, description, tagsStr, category, image, published, updated, pinned, comment, author, sourceLink, password) {
    const fm = {};
    fm.title = title;
    fm.draft = draft;
    if (author) fm.author = author;
    if (description) fm.description = description;
    if (tagsStr) fm.tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
    if (category) fm.category = category;
    if (image) fm.image = image;
    if (sourceLink) fm.sourceLink = sourceLink;
    if (password) fm.password = password;
    if (published) fm.published = published;
    if (updated) fm.updated = updated;
    if (pinned) fm.pinned = true;
    fm.comment = comment !== false;
    var y = jsyaml.dump(fm, { lineWidth: -1, quotingType: "'", forceQuotes: false });
    y = y.replace(/'(\d{4}-\d{2}-\d{2})'/g, '$1');
    y = y.replace(/(\d{4}-\d{2}-\d{2})T00:00:00\.000Z/g, '$1');
    var body = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
    return '---\n' + y + '---\n' + body;
}
