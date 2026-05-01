import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { walk } from "../src/content/walk.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "repo-db-walk-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function touch(relPath: string, content = "") {
  const full = join(dir, relPath);
  const parent = full.split("/").slice(0, -1).join("/");
  await mkdir(parent, { recursive: true });
  await writeFile(full, content, "utf8");
}

describe("walk", () => {
  it("returns paths relative to cwd, sorted", async () => {
    await touch("posts/2024/b.md");
    await touch("posts/2024/a.md");
    await touch("posts/2023/c.md");
    const result = await walk("posts/**/*.md", dir);
    expect(result).toEqual([
      "posts/2023/c.md",
      "posts/2024/a.md",
      "posts/2024/b.md",
    ]);
  });

  it("excludes directories and files that don't match", async () => {
    await touch("posts/a.md");
    await touch("posts/b.txt");
    await mkdir(join(dir, "posts/empty-dir"), { recursive: true });
    const result = await walk("posts/**/*.md", dir);
    expect(result).toEqual(["posts/a.md"]);
  });

  it("skips dotfiles by default", async () => {
    await touch("posts/.hidden.md");
    await touch("posts/visible.md");
    const result = await walk("posts/**/*.md", dir);
    expect(result).toEqual(["posts/visible.md"]);
  });

  it("returns empty array when nothing matches", async () => {
    const result = await walk("posts/**/*.md", dir);
    expect(result).toEqual([]);
  });
});
