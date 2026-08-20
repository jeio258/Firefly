// friends-copy.js — 友链页「复制」按钮交互
//
// 对应 markup（src/content/spec/friends.mdx）：
//   <button class="copy-btn ..." data-copy-value={value}>
//     <svg class="... icon-copy" ...></svg>
//     <svg class="... hidden icon-success text-green-500" ...></svg>
//   </button>
//
// 点击后复制 data-copy-value 的值，短暂显示绿色对勾（icon-success）作为反馈。
// 使用事件委托挂在 document 上，兼容 Swup 页面切换后重新注入的 DOM。

(function () {
	"use strict";

	var FEEDBACK_MS = 1600;

	function copyText(text, done) {
		if (navigator.clipboard && window.isSecureContext) {
			navigator.clipboard
				.writeText(text)
				.then(function () {
					done(true);
				})
				.catch(function () {
					done(false);
				});
			return;
		}
		// 降级：textarea + execCommand（非安全上下文/旧浏览器）
		var ta = document.createElement("textarea");
		ta.value = text;
		ta.setAttribute("readonly", "");
		ta.style.position = "fixed";
		ta.style.opacity = "0";
		document.body.appendChild(ta);
		ta.select();
		var ok = false;
		try {
			ok = document.execCommand("copy");
		} catch (e) {
			ok = false;
		}
		document.body.removeChild(ta);
		done(ok);
	}

	function showCopied(btn) {
		var copyIcon = btn.querySelector(".icon-copy");
		var successIcon = btn.querySelector(".icon-success");
		if (copyIcon) copyIcon.classList.add("hidden");
		if (successIcon) successIcon.classList.remove("hidden");
		clearTimeout(btn._copyResetTimer);
		btn._copyResetTimer = setTimeout(function () {
			if (copyIcon) copyIcon.classList.remove("hidden");
			if (successIcon) successIcon.classList.add("hidden");
		}, FEEDBACK_MS);
	}

	document.addEventListener("click", function (event) {
		var btn = event.target.closest(".copy-btn[data-copy-value]");
		if (!btn) return;
		var value = btn.getAttribute("data-copy-value");
		if (value == null) return;
		copyText(value, function (ok) {
			if (ok) {
				showCopied(btn);
			} else {
				btn.setAttribute("aria-label", "复制失败，请手动复制");
				// 简单提示：借用系统 prompt 让用户看到原文
				window.prompt("复制失败，请手动复制：", value);
			}
		});
	});
})();
