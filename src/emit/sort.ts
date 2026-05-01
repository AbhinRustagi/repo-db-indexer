import type { TypeConfig } from "../config/schema.js";
import type { ContentItem } from "../content/discover.js";

export function sortItems(
  items: ContentItem[],
  typeConfig: TypeConfig
): ContentItem[] {
  if (!typeConfig.sort) return items;
  const { field, order } = typeConfig.sort;
  const dir = order === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = a.data[field];
    const bv = b.data[field];
    if (av === undefined && bv === undefined) return 0;
    if (av === undefined) return 1;
    if (bv === undefined) return -1;
    if ((av as number | string) < (bv as number | string)) return -1 * dir;
    if ((av as number | string) > (bv as number | string)) return 1 * dir;
    return 0;
  });
}
