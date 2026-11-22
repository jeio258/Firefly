#!/usr/bin/env node
/**
 * 构建后台样式产物 admin.css。
 *
 * admin.css 是生成物，源文件是 styles/input.css；直接改 admin.css 会在下次构建被覆盖。
 * Tailwind v4 未安装 @tailwindcss/cli，这里用已安装的 tailwindcss 编译 API，
 * 并自行从后台源码提取候选类名（compile().build() 只接受候选列表，不扫描文件）。
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(`${process.cwd()}/`);
const { compile } = require("tailwindcss");

const ROOT = process.cwd();
const ADMIN_DIR = path.join(ROOT, "public/admin");
const INPUT = path.join(ADMIN_DIR, "styles/input.css");
const OUTPUT = path.join(ADMIN_DIR, "styles/admin.css");

const UTILITY_PREFIX =
	/^(?:flex|grid|hidden|block|inline|absolute|relative|sticky|fixed|inset|items-|justify-|self-|gap-|space-|p[xytblr]?-|m[xytblr]?-|w-|h-|min-|max-|size-|text-|font-|leading-|tracking-|rounded|border|bg-|shadow|backdrop-|transition|duration-|ease-|opacity-|overflow-|z-|top-|bottom-|left-|right-|order-|col-|row-|divide-|ring|aspect-|object-|cursor-|select-|whitespace-|truncate|break-|list-|uppercase|lowercase|capitalize|italic|underline|line-|align-|table-|colspan|pointer-events-|touch-|will-change-|transform|scale-|rotate-|translate-|origin-|mix-blend-|filter|blur|saturate|grayscale|invert|sr-only|not-sr-only|group|peer|hover:|focus:|focus-visible:|active:|disabled:|sm:|md:|lg:|xl:|2xl:|max-|min-|dark:|motion-|print:)/;

function listSources(dir) {
	const files = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "styles") continue;
			files.push(...listSources(full));
		} else if (/\.(html|js)$/.test(entry.name)) {
			files.push(full);
		}
	}
	return files;
}

function collectCandidates(files) {
	const candidates = new Set();
	const push = (token) => {
		const t = token.replace(/^["'`]+|["'`]+$/g, "");
		if (!t || t.length > 120) return;
		if (/[^\w\-:./[\]%(),&!#]/.test(t)) return;
		if (UTILITY_PREFIX.test(t)) candidates.add(t);
	};

	for (const file of files) {
		const src = fs.readFileSync(file, "utf8");
		for (const match of src.matchAll(
			/class(?:Name)?\s*=\s*["'`]([^"'`]*)["'`]/g,
		)) {
			for (const token of match[1].split(/[\s$]+/)) push(token);
		}
		for (const match of src.matchAll(/\b([a-z][\w:[\]%/.()-]*)\b/g))
			push(match[1]);
	}
	return [...candidates];
}

const compiler = await compile(fs.readFileSync(INPUT, "utf8"), {
	base: path.dirname(INPUT),
	loadStylesheet: async (id, base) => {
		const resolved =
			id === "tailwindcss"
				? require.resolve("tailwindcss/index.css")
				: path.resolve(base, id);
		return {
			path: resolved,
			base: path.dirname(resolved),
			content: fs.readFileSync(resolved, "utf8"),
		};
	},
});

const candidates = collectCandidates(listSources(ADMIN_DIR));
const css = compiler.build(candidates);
fs.writeFileSync(OUTPUT, css);
console.log(
	`[admin-css] ${candidates.length} candidates -> ${path.relative(ROOT, OUTPUT)} (${(css.length / 1024).toFixed(1)} KB)`,
);
