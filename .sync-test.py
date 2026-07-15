"""
同步生产版 → 测试版（仅去除 GitHub 认证）
用法: python3 .sync-test.py
"""
import shutil

# 1. 复制生产版
shutil.copy2('public/admin/index.html', 'public/admin/test.html')

with open('public/admin/test.html', 'r') as f:
    html = f.read()

# 2. 改标题
html = html.replace('后台管理 · 临渊羡鱼', '后台管理 · 本地测试')

# 3. 移除初始"请登录"占位文本
html = html.replace(
    '<div id="main-view">\n            <div class="page-heading">\n                <h1>管理控制台</h1>\n                <p>请登录 GitHub 以管理文章和友链</p>\n            </div>\n        </div>',
    '<div id="main-view"></div>'
)

# 4. 替换 GitHub 导入和认证代码
import re

# 4a. 替换 import 行
html = html.replace(
    "import { getAllPostFiles, getFileContent, savePost, deletePost } from './api.js';\n        import { renderReviewList, renderFriendsList } from './links.js';",
    "// 测试模式: 使用模拟数据替代 GitHub API\n        const MOCK_POSTS = [\n            { path: 'src/content/posts/hello-world.md', name: 'hello-world.md' },\n            { path: 'src/content/posts/用Firefly搭建个人博客.md', name: '用Firefly搭建个人博客.md' },\n            { path: 'src/content/posts/测试文章-草稿.md', name: '测试文章-草稿.md' },\n        ];\n        const MOCK = {\n            'src/content/posts/用Firefly搭建个人博客.md': { title:'用Firefly搭建个人博客', published:new Date('2025-01-15'), updated:new Date('2025-06-01'), description:'使用Firefly主题快速搭建个人博客', tags:['Firefly','Astro','博客'], category:'前端开发', image:'https://picsum.photos/800/400', author:'示例作者', comment:true, pinned:false, draft:false, sourceLink:'https://github.com/CuteLeaf/Firefly', password:'', body:'## Hello Firefly\\n\\n示例文章内容。\\n' },\n            'src/content/posts/测试文章-草稿.md': { title:'测试文章（草稿）', published:new Date('2025-06-15'), description:'草稿文章', tags:['测试'], category:'杂项', draft:true, comment:true, pinned:false, body:'草稿内容。\\n' },\n        };\n        function mockGetPost(p) { var d=MOCK[p]||{title:p.split('/').pop().replace(/\\.(md|mdx)$/i,''),draft:false,comment:true,body:''}; return Object.assign({},d,{path:p,sha:'m'+Math.random().toString(36).slice(2,8)}); }\n        function $(id){return document.getElementById(id);}"
)

# 4b. 替换 accessToken 初始化和 initApp
html = html.replace(
    "let accessToken = localStorage.getItem('github_token') || '';\n        const mainView = document.getElementById('main-view');",
    "let accessToken = 'mock';\n        let GITHUB_OWNER='test', GITHUB_REPO='test', GITHUB_BRANCH='master', POSTS_BASE_PATH='src/content/posts';\n        const mainView = document.getElementById('main-view');\n        function $(id){return document.getElementById(id);}"
)

# 4c. 用 mock 替换 GitHub API 调用
html = html.replace(
    'const post = await getFileContent(GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, decodeURIComponent(path), accessToken);',
    'var post = mockGetPost(decodeURIComponent(path));'
)

html = html.replace(
    "const res = await savePost(GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, filePath, b64(final), sha, accessToken);\n                if (res.ok) { alert('保存成功'); window.location.hash = '#/posts'; }\n                else { const e = await res.json().catch(()=>({})); alert('保存失败: ' + e.message); }",
    "alert('✅ 保存成功（测试模式）'); window.location.hash = '#/posts';"
)

html = html.replace(
    "const res = await deletePost(GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, fp, s, accessToken);\n                if (res.ok) { alert('已删除'); window.location.hash = '#/posts'; }\n                else { const e = await res.json().catch(()=>({})); alert('删除失败: ' + e.message); }",
    "alert('✅ 已删除（测试模式）'); window.location.hash = '#/posts';"
)

html = html.replace(
    'const files = await getAllPostFiles(GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, POSTS_BASE_PATH, accessToken);',
    'var files = MOCK_POSTS;'
)

# 4d. 替换友链渲染
html = html.replace(
    "renderReviewList(rc, { owner: GITHUB_OWNER, repo: GITHUB_REPO, branch: GITHUB_BRANCH, token: accessToken });",
    "rc.innerHTML = '<div style=\"padding:2rem 0;text-align:center;color:var(--text-tertiary);font-size:0.875rem;\">暂无待审核申请（测试模式）</div>';"
)

html = html.replace(
    "renderFriendsList(ac, { owner: GITHUB_OWNER, repo: GITHUB_REPO, branch: GITHUB_BRANCH, token: accessToken });",
    "renderFriendsView_Mock(ac);"
)

# 在 renderFriendsView 函数前添加 mock 友链渲染函数
html = html.replace(
    "function renderFriendsView() {",
    "function renderFriendsView_Mock(container) {\n            var friends = [{name:'示例博客A',desc:'前端开发'},{name:'示例博客B',desc:'摄影日记'},{name:'示例博客C',desc:'技术随笔'}];\n            container.innerHTML = '<div style=\"display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem;\">' +\n                friends.map(function(f){ return '<div style=\"display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;border-radius:0.75rem;border:1px solid var(--line-divider);\">' +\n                    '<div style=\"width:2.5rem;height:2.5rem;border-radius:50%;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--primary);flex-shrink:0;\">'+f.name[0]+'</div>' +\n                    '<div style=\"flex:1;\"><div style=\"font-weight:500;font-size:0.8125rem;\">'+f.name+'</div>' +\n                    '<div style=\"font-size:0.6875rem;color:var(--text-tertiary);\">'+f.desc+'</div></div></div>'; }).join('') + '</div>';\n        }\n\n        function renderFriendsView() {"
)

# 4e. 简化登录/配置加载逻辑
html = html.replace(
    "async function loginWithGithub() {",
    "// 测试模式: 无需登录\n        async function loginWithGithub() {"
)

# 4f. 替换 initApp 跳过配置加载
html = html.replace(
    "async function initApp() {\n            if (!accessToken) { handleRoute(); return; }\n            try {\n                const res = await fetch(CONFIG_ENDPOINT);\n                if (!res.ok) throw new Error('无法获取配置');\n                const cfg = jsyaml.load(await res.text());\n                const repoFull = cfg.backend?.repo || cfg.repo;\n                if (!repoFull) throw new Error('缺少 repo');\n                const [owner, repo] = repoFull.split('/');\n                GITHUB_OWNER = owner; GITHUB_REPO = repo;\n                GITHUB_BRANCH = cfg.backend?.branch || cfg.branch || 'master';\n                if (cfg.collections?.length) { const c = cfg.collections.find(c => c.folder); if (c) POSTS_BASE_PATH = c.folder; }\n                handleRoute();\n            } catch (e) {\n                console.error(e);\n                alert('配置加载失败，请检查 admin/config.yml');\n                logout();\n            }\n        }",
    "async function initApp() {\n            handleRoute();\n        }"
)

# 4g. 删除 logout 中重置 accessToken 的逻辑（已 mock）
html = html.replace(
    "function logout() {\n            localStorage.removeItem('github_token');\n            accessToken = '';\n            window.location.hash = '#/login';\n            updateNav();\n            renderLogin();\n        }",
    "// 测试模式: 无需登出\n        function logout() {}"
)

# 4h. 简化 DOMContentLoaded
html = html.replace(
    "document.addEventListener('DOMContentLoaded', () => {\n            document.getElementById('login-btn').addEventListener('click', loginWithGithub);\n            var themeBtn = document.getElementById('theme-toggle');\n            if (themeBtn) themeBtn.addEventListener('click', toggleTheme);\n            window.addEventListener('hashchange', handleRoute);\n            window.addEventListener('theme-change', function() {\n                var theme = localStorage.getItem('theme');\n                if (theme === 'dark') document.documentElement.classList.add('dark');\n                else if (theme === 'light') document.documentElement.classList.remove('dark');\n                updateThemeIcon();\n            });\n            updateThemeIcon();\n            const params = new URLSearchParams(window.location.search);\n            const tokenFromUrl = params.get('token');\n            if (tokenFromUrl) {\n                accessToken = tokenFromUrl;\n                localStorage.setItem('github_token', tokenFromUrl);\n                history.replaceState({}, document.title, location.pathname);\n            }\n            initApp();\n        });",
    "document.addEventListener('DOMContentLoaded', function() {\n            if (document.getElementById('theme-toggle')) {\n                document.getElementById('theme-toggle').onclick = function() {\n                    document.documentElement.classList.toggle('dark');\n                    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');\n                    updateThemeIcon();\n                };\n            }\n            window.addEventListener('hashchange', handleRoute);\n            window.addEventListener('theme-change', function() {\n                var t = localStorage.getItem('theme');\n                if (t === 'dark') document.documentElement.classList.add('dark');\n                else if (t === 'light') document.documentElement.classList.remove('dark');\n                updateThemeIcon();\n            });\n            updateThemeIcon();\n            initApp();\n        });"
)

with open('public/admin/test.html', 'w') as f:
    f.write(html)

print('✅ 测试版已同步')
print('   生产版 → 测试版完成')
