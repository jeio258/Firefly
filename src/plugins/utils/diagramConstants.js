/**
 * 图表 rehype 插件共用的 CSS 类名常量
 *
 * 修改类名时只需改这一处，避免 CSS / JS 不一致导致交互失效。
 * 仅客户端脚本（以 ?raw 注入，无法 import）使用的类名不在此处。
 */

// 容器
export const DIAGRAM_CONTAINER = "diagram-container";
export const DIAGRAM_WRAPPER = "diagram-wrapper";

// Mermaid
export const MERMAID_CONTAINER = "mermaid-diagram-container";
export const MERMAID_WRAPPER = "mermaid-wrapper";
export const MERMAID_SVG_LIGHT = "mermaid-svg-light";
export const MERMAID_SVG_DARK = "mermaid-svg-dark";
export const MERMAID_ERROR = "mermaid-error";
export const MERMAID_FALLBACK_CODE = "mermaid-fallback-code";

// PlantUML
export const PLANTUML_CONTAINER = "plantuml-diagram-container";
export const PLANTUML_WRAPPER = "plantuml-wrapper";
export const PLANTUML_IMAGE = "plantuml-image";
