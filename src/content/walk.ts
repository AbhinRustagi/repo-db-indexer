import fastGlob from "fast-glob";

export async function walk(pattern: string, cwd: string): Promise<string[]> {
  const matches = await fastGlob(pattern, {
    cwd,
    onlyFiles: true,
    dot: false,
  });
  return matches.sort();
}
