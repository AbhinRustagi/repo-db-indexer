export function applyProjection(
  data: Record<string, unknown>,
  fields: string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in data) out[field] = data[field];
  }
  return out;
}
