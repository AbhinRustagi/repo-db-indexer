export interface ProjectableItem {
  data: Record<string, unknown>;
  path: string;
}

export const IMPLICIT_FIELDS: ReadonlySet<string> = new Set(["path"]);

export function applyProjection(
  item: ProjectableItem,
  fields: string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in item.data) {
      out[field] = item.data[field];
      continue;
    }
    if (field === "path") {
      out[field] = item.path;
    }
  }
  return out;
}
