import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Config } from "../src/config/schema.js";
import type { ContentItem } from "../src/content/discover.js";
import { emitReadme } from "../src/emit/readme.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "repo-db-readme-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const items: ContentItem[] = [
  {
    type: "post",
    path: "posts/a.md",
    format: "markdown-frontmatter",
    data: { title: "Hello", slug: "hello" },
    body: "x",
  },
];

function cfg(update: boolean) {
  return Config.parse({
    name: "my-content",
    update_readme: update,
    types: {
      post: {
        content: "posts/**/*.md",
        format: "markdown-frontmatter",
        schema: "ignored",
        projection: "ignored",
        key: "slug",
      },
    },
  });
}

describe("emitReadme", () => {
  it("returns null when update_readme is false", async () => {
    expect(await emitReadme(cfg(false), items, dir)).toBeNull();
  });

  it("creates README.md with title and generated block when missing", async () => {
    const path = await emitReadme(cfg(true), items, dir);
    const out = await readFile(path!, "utf8");
    expect(out).toContain("# my-content");
    expect(out).toContain("<!-- repo-db-indexer:start -->");
    expect(out).toContain("<!-- repo-db-indexer:end -->");
    expect(out).toContain("- [Hello](posts/a.md)");
  });

  it("replaces only the marker section in an existing README", async () => {
    const existing =
      "# Custom Title\n\nUser intro paragraph.\n\n" +
      "<!-- repo-db-indexer:start -->\nold content\n<!-- repo-db-indexer:end -->\n\n" +
      "## After section preserved\n";
    await writeFile(join(dir, "README.md"), existing, "utf8");

    const path = await emitReadme(cfg(true), items, dir);
    const out = await readFile(path!, "utf8");
    expect(out).toContain("# Custom Title");
    expect(out).toContain("User intro paragraph.");
    expect(out).toContain("## After section preserved");
    expect(out).not.toContain("old content");
    expect(out).toContain("- [Hello](posts/a.md)");
  });

  it("appends generated block to README without markers", async () => {
    await writeFile(join(dir, "README.md"), "# Existing\n\nIntro.\n", "utf8");
    const path = await emitReadme(cfg(true), items, dir);
    const out = await readFile(path!, "utf8");
    expect(out).toContain("# Existing");
    expect(out).toContain("Intro.");
    expect(out).toContain("<!-- repo-db-indexer:start -->");
  });
});
