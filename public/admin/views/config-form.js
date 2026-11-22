/**
 * 把 TS 配置里的对象字面量解析成可编辑字段，并按行精确回写。
 * 只处理单行、字面量值（字符串/数字/布尔/单行数组）；多行数组、模板串、函数调用等
 * 复杂项不进入表单，避免回写破坏代码——这些项仍可用「代码模式」编辑。
 */

const KEY_LINE = /^(\s*)([A-Za-z_$][\w$]*)\s*:\s*(.*)$/;

function stripTrailingComment(value) {
	let out = "";
	let quote = null;
	for (let i = 0; i < value.length; i++) {
		const ch = value[i];
		if (quote) {
			out += ch;
			if (ch === "\\") {
				out += value[i + 1] ?? "";
				i++;
			} else if (ch === quote) quote = null;
			continue;
		}
		if (ch === '"' || ch === "'" || ch === "`") {
			quote = ch;
			out += ch;
			continue;
		}
		if (ch === "/" && value[i + 1] === "/") break;
		out += ch;
	}
	return out.trim();
}

function parseLiteral(raw) {
	const v = stripTrailingComment(raw);
	if (v === "") return { kind: "complex" };
	if (v === "true" || v === "false") return { kind: "boolean", value: v === "true" };
	if (v === "null" || v === "undefined") return { kind: "complex" };
	if (/^-?\d+(\.\d+)?$/.test(v)) return { kind: "number", value: Number(v) };
	const str = v.match(/^"((?:[^"\\]|\\.)*)"$/) || v.match(/^'((?:[^'\\]|\\.)*)'$/);
	if (str) {
		let text;
		try {
			text = JSON.parse(`"${str[1].replace(/"/g, '\\"').replace(/\\\\"/g, '\\"')}"`);
		} catch {
			text = str[1];
		}
		return { kind: "string", value: text };
	}
	if (/^\[[^\]]*\]$/.test(v)) {
		const items = v
			.slice(1, -1)
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean)
			.map((s) => {
				const m = s.match(/^"((?:[^"\\]|\\.)*)"$/) || s.match(/^'((?:[^'\\]|\\.)*)'$/);
				return m ? m[1] : s;
			});
		return { kind: "list", value: items };
	}
	return { kind: "complex" };
}

/** 去掉字符串与注释后统计花括号净增量，用于确定对象块边界 */
function braceDelta(line) {
	let out = "";
	let quote = null;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (quote) {
			if (ch === "\\") { i++; continue; }
			if (ch === quote) quote = null;
			continue;
		}
		if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
		if (ch === "/" && line[i + 1] === "/") break;
		out += ch;
	}
	return (out.match(/\{/g) || []).length - (out.match(/\}/g) || []).length;
}

const BLOCK_START =
	/^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:[A-Za-z_$.]+\(\s*)?\{\s*$/;

/**
 * 解析文件中所有「对象字面量块」：既包括 `const x: T = { ... }`，
 * 也包括 `const pages = resolvePageToggles({ ... })` 这类函数包裹的对象。
 * path 以块的常量名开头（siteConfig.title / pages.friends），保证跨块唯一。
 */
export function parseConfigFields(text) {
	const lines = text.split("\n");
	const fields = [];
	const blocks = [];

	for (let b = 0; b < lines.length; b++) {
		const m = lines[b].match(BLOCK_START);
		if (m) {
			blocks.push({ constName: m[1], start: b });
			continue;
		}
		// 赋值跨行：`const x: T =` 换行后才出现 `{` 或 `call({`
		const cont = lines[b].match(
			/^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*$/,
		);
		if (!cont) continue;
		for (let j = b + 1; j < Math.min(b + 8, lines.length); j++) {
			const t = lines[j].trim();
			if (t === "" || t.startsWith("//") || t.startsWith("/*") || t.startsWith("*")) continue;
			if (/^(?:[A-Za-z_$.]+\(\s*)?\{\s*$/.test(t)) {
				blocks.push({ constName: cont[1], start: j });
				b = j;
			}
			break;
		}
	}

	for (const block of blocks) {
		const constName = block.constName;
		const b = block.start;

		const stack = [];
		let arrayDepth = 0;
		let inBlockComment = false;
		let depth = 0;

		for (let i = b; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();

			if (inBlockComment) {
				if (line.includes("*/")) inBlockComment = false;
				continue;
			}
			if (trimmed.startsWith("/*")) {
				if (!trimmed.includes("*/")) inBlockComment = true;
				continue;
			}

			const delta = braceDelta(line);
			const before = depth;
			depth += delta;

			// 数组内部：对象数组没有稳定路径，跳过
			if (/^[A-Za-z_$][\w$]*\s*:\s*\[\s*$/.test(trimmed)) {
				arrayDepth += 1;
				continue;
			}
			if (arrayDepth > 0) {
				if (/^\]\s*,?\s*$/.test(trimmed)) arrayDepth -= 1;
				continue;
			}

			if (trimmed.startsWith("//") || trimmed === "") {
				if (before > 0 && depth === 0) break;
				continue;
			}

			const container = line.match(/^(\s*)([A-Za-z_$][\w$]*)?\s*:\s*\{\s*$/);
			if (container) {
				stack.push(container[2]);
			} else if (/^\}\s*,?\s*;?\s*$/.test(trimmed)) {
				stack.pop();
			} else {
				const km = line.match(KEY_LINE);
				if (km) {
					const [, indent, key, rest] = km;
					const cleaned = stripTrailingComment(rest).trim();
					if (cleaned !== "") {
						const hasComma = /,$/.test(cleaned);
						const valueText = hasComma ? cleaned.slice(0, -1).trimEnd() : cleaned;
						const literal = parseLiteral(valueText);
						const valueStart = line.indexOf(valueText, indent.length + key.length);
						if (literal.kind !== "complex" && valueStart !== -1) {
							fields.push({
								path: [constName, ...stack, key].filter(Boolean).join("."),
								key,
								label: key,
								group: [constName, stack[0]].filter(Boolean).join(" / "),
								line: i,
								valueStart,
								valueEnd: valueStart + valueText.length,
								comma: hasComma ? "," : "",
								kind: literal.kind,
								value: literal.value,
								depth: indent.length,
							});
						}
					}
				}
			}

			if (i > b && depth <= 0) break;
		}
	}

	return { fields };
}

export function formatValue(field, value) {
	if (field.kind === "boolean") return value ? "true" : "false";
	if (field.kind === "number") {
		const n = Number(value);
		return Number.isFinite(n) ? String(n) : "0";
	}
	if (field.kind === "list") {
		const arr = Array.isArray(value)
			? value
			: String(value)
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean);
		return `[${arr.map((s) => JSON.stringify(String(s))).join(", ")}]`;
	}
	return JSON.stringify(String(value ?? ""));
}

/** 只回写改动过的字段，其余行保持原样 */
export function patchConfigText(text, fields, changes) {
	const lines = text.split("\n");
	for (const field of fields) {
		if (!(field.path in changes)) continue;
		const line = lines[field.line];
		if (line === undefined) continue;
		const next = formatValue(field, changes[field.path]);
		lines[field.line] =
			line.slice(0, field.valueStart) + next + line.slice(field.valueEnd);
	}
	return lines.join("\n");
}

export function fieldsToGroups(fields) {
	const groups = new Map();
	for (const field of fields) {
		if (!groups.has(field.group)) groups.set(field.group, []);
		groups.get(field.group).push(field);
	}
	return [...groups.entries()].map(([name, items]) => ({ name, items }));
}
