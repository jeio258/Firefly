import type { WidgetComponentConfig } from "@/types/config";

// 组件标题开关：未配置时默认显示
export function resolveWidgetTitle(
	widgetConfig?: WidgetComponentConfig,
): boolean {
	return widgetConfig?.showTitle !== false;
}

// 折叠阈值：未配置 threshold 时不折叠
export function resolveWidgetCollapse(
	widgetConfig: WidgetComponentConfig | undefined,
	itemCount: number,
): boolean {
	const threshold = widgetConfig?.specificConfig?.collapseThreshold;
	return threshold ? itemCount > threshold : false;
}

// 折叠态高度：分类/标签等列表类组件折叠后露出两行左右
export const WIDGET_COLLAPSED_HEIGHT = "7.5rem";
