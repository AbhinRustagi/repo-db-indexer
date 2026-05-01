import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Config } from "../src/config/schema.js";
import { discover } from "../src/content/discover.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "repo-db-discover-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function write(relPath: string, content: string) {
  const full = join(dir, relPath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, "utf8");
}

function configWith(types: Record<string, unknown>): ReturnType<typeof Config.parse> {
  return Config.parse({ name: "t", types });
}

describe("discover", () => {
  it("walks each type and parses items", async () => {
    await write(
      "posts/a.md",
      "---\ntitle: A\nslug: a\n---\nbody-a\n"
    );
    await write("notes/n1.json", '{"id":"n1","text":"hi"}');

    const cfg = configWith({
      post: {
        content: "posts/**/*.md",
        format: "markdown-frontmatter",
        schema: "ignored",
        projection: "ignored",
        key: "slug",
      },
      note: {
        content: "notes/**/*.json",
        format: "json",
        schema: "ignored",
        projection: "ignored",
        key: "id",
      },
    });

    const { items, errors } = await discover(cfg, dir);
    expect(errors).toEqual([]);
    expect(items).toHaveLength(2);
    const post = items.find((i) => i.type === "post");
    const note = items.find((i) => i.type === "note");
    expect(post?.data).toEqual({ title: "A", slug: "a" });
    expect(post?.body).toBe("body-a\n");
    expect(note?.data).toEqual({ id: "n1", text: "hi" });
    expect(note?.body).toBeUndefined();
  });

  it("collects parse errors without failing the run", async () => {
    await write("posts/good.md", "---\ntitle: ok\n---\nbody\n");
    await write("posts/bad.md", "---\ntitle: [unclosed\n---\nx\n");

    const cfg = configWith({
      post: {
        content: "posts/**/*.md",
        format: "markdown-frontmatter",
        schema: "x",
        projection: "x",
        key: "slug",
      },
    });

    const { items, errors } = await discover(cfg, dir);
    expect(items).toHaveLength(1);
    expect(items[0]?.path).toBe("posts/good.md");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      type: "post",
      path: "posts/bad.md",
      reason: "invalid-frontmatter",
    });
  });

  it("returns empty result when no files match", async () => {
    const cfg = configWith({
      post: {
        content: "posts/**/*.md",
        format: "markdown-frontmatter",
        schema: "x",
        projection: "x",
        key: "slug",
      },
    });
    const result = await discover(cfg, dir);
    expect(result).toEqual({ items: [], errors: [] });
  });
});
