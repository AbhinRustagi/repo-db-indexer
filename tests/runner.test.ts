import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Config } from "../src/config/schema.js";
import { discover } from "../src/content/discover.js";
import { runValidation } from "../src/validation/runner.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "repo-db-runner-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function write(rel: string, content: string) {
  const full = join(dir, rel);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, "utf8");
}

const postSchema = {
  type: "object",
  required: ["title", "slug", "date"],
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    slug: { type: "string" },
    date: { type: "string", format: "date" },
    tags: { type: "array", items: { type: "string" } },
  },
};

const postProjection = ["title", "slug", "date", "tags"];

async function setupPostType(extra: Partial<Record<string, unknown>> = {}) {
  await write("schemas/post.schema.json", JSON.stringify(postSchema));
  await write("schemas/post.index.json", JSON.stringify(postProjection));
  return Config.parse({
    name: "t",
    types: {
      post: {
        content: "posts/**/*.md",
        format: "markdown-frontmatter",
        schema: "schemas/post.schema.json",
        projection: "schemas/post.index.json",
        key: "slug",
        ...extra,
      },
    },
  });
}

describe("runValidation", () => {
  it("returns no diagnostics for a valid item", async () => {
    const cfg = await setupPostType();
    await write(
      "posts/a.md",
      "---\ntitle: A\nslug: a\ndate: \"2024-01-01\"\ntags:\n  - x\n---\nbody\n"
    );
    const result = await discover(cfg, dir);
    const diags = await runValidation(cfg, result, dir);
    expect(diags).toEqual([]);
  });

  it("reports missing required fields", async () => {
    const cfg = await setupPostType();
    await write("posts/a.md", "---\ntitle: A\n---\nbody\n");
    const result = await discover(cfg, dir);
    const diags = await runValidation(cfg, result, dir);
    const required = diags.filter((d) => d.rule === "required-fields");
    expect(required.length).toBeGreaterThan(0);
    expect(required[0]?.severity).toBe("error");
  });

  it("reports type-mismatch separately from required-fields", async () => {
    const cfg = await setupPostType();
    await write(
      "posts/a.md",
      "---\ntitle: 123\nslug: a\ndate: \"2024-01-01\"\n---\nbody\n"
    );
    const result = await discover(cfg, dir);
    const diags = await runValidation(cfg, result, dir);
    expect(diags.some((d) => d.rule === "type-mismatch")).toBe(true);
  });

  it("reports unknown-fields when schema has additionalProperties:false", async () => {
    const cfg = await setupPostType();
    await write(
      "posts/a.md",
      "---\ntitle: A\nslug: a\ndate: \"2024-01-01\"\nextra: nope\n---\nbody\n"
    );
    const result = await discover(cfg, dir);
    const diags = await runValidation(cfg, result, dir);
    const unknown = diags.filter((d) => d.rule === "unknown-fields");
    expect(unknown.length).toBe(1);
    expect(unknown[0]?.severity).toBe("warn");
  });

  it("reports duplicate keys for both items", async () => {
    const cfg = await setupPostType();
    await write(
      "posts/a.md",
      "---\ntitle: A\nslug: dup\ndate: \"2024-01-01\"\n---\nbody\n"
    );
    await write(
      "posts/b.md",
      "---\ntitle: B\nslug: dup\ndate: \"2024-01-02\"\n---\nbody\n"
    );
    const result = await discover(cfg, dir);
    const diags = await runValidation(cfg, result, dir);
    const dups = diags.filter((d) => d.rule === "duplicate-key");
    expect(dups).toHaveLength(2);
    expect(dups.map((d) => d.path).sort()).toEqual([
      "posts/a.md",
      "posts/b.md",
    ]);
  });

  it("reports empty-body when severity is overridden to error", async () => {
    const baseCfg = await setupPostType();
    const cfg = Config.parse({
      ...baseCfg,
      types: {
        post: { ...baseCfg.types["post"]!, rules: { "empty-body": "error" } },
      },
    });
    await write(
      "posts/a.md",
      "---\ntitle: A\nslug: a\ndate: \"2024-01-01\"\n---\n   \n"
    );
    const result = await discover(cfg, dir);
    const diags = await runValidation(cfg, result, dir);
    const empty = diags.filter((d) => d.rule === "empty-body");
    expect(empty).toHaveLength(1);
    expect(empty[0]?.severity).toBe("error");
  });

  it("reports projection-missing for fields not in item data", async () => {
    await write(
      "schemas/post.schema.json",
      JSON.stringify({ type: "object", additionalProperties: true })
    );
    await write(
      "schemas/post.index.json",
      JSON.stringify(["title", "slug", "missing_field"])
    );
    const cfg = Config.parse({
      name: "t",
      types: {
        post: {
          content: "posts/**/*.md",
          format: "markdown-frontmatter",
          schema: "schemas/post.schema.json",
          projection: "schemas/post.index.json",
          key: "slug",
        },
      },
    });
    await write("posts/a.md", "---\ntitle: A\nslug: a\n---\nbody\n");
    const result = await discover(cfg, dir);
    const diags = await runValidation(cfg, result, dir);
    const missing = diags.filter((d) => d.rule === "projection-missing");
    expect(missing).toHaveLength(1);
    expect(missing[0]?.message).toContain("missing_field");
  });

  it("propagates parse errors as diagnostics with the right rule", async () => {
    const cfg = await setupPostType();
    await write("posts/bad.md", "---\ntitle: [unclosed\n---\n");
    const result = await discover(cfg, dir);
    const diags = await runValidation(cfg, result, dir);
    expect(diags.some((d) => d.rule === "invalid-frontmatter")).toBe(true);
  });

  it("filters out diagnostics for rules set to off", async () => {
    const baseCfg = await setupPostType();
    const cfg = Config.parse({
      ...baseCfg,
      types: {
        post: {
          ...baseCfg.types["post"]!,
          rules: { "unknown-fields": "off" },
        },
      },
    });
    await write(
      "posts/a.md",
      "---\ntitle: A\nslug: a\ndate: \"2024-01-01\"\nextra: nope\n---\nbody\n"
    );
    const result = await discover(cfg, dir);
    const diags = await runValidation(cfg, result, dir);
    expect(diags.some((d) => d.rule === "unknown-fields")).toBe(false);
  });
});
