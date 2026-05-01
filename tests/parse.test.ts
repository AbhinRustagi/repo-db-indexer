import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseItem } from "../src/content/parse.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "repo-db-parse-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function write(name: string, content: string): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, content, "utf8");
  return path;
}

describe("parseItem (markdown-frontmatter)", () => {
  it("extracts YAML frontmatter and body", async () => {
    const path = await write(
      "post.md",
      "---\ntitle: Hello\ndate: 2024-01-01\n---\nBody here.\n"
    );
    const result = await parseItem(path, "markdown-frontmatter");
    expect(result).toEqual({
      ok: true,
      data: { title: "Hello", date: new Date("2024-01-01") },
      body: "Body here.\n",
    });
  });

  it("returns empty data and full content when frontmatter is absent", async () => {
    const path = await write("post.md", "Just body content.\n");
    const result = await parseItem(path, "markdown-frontmatter");
    expect(result).toEqual({
      ok: true,
      data: {},
      body: "Just body content.\n",
    });
  });

  it("fails on malformed frontmatter YAML", async () => {
    const path = await write(
      "post.md",
      "---\ntitle: [unclosed\n---\nbody\n"
    );
    const result = await parseItem(path, "markdown-frontmatter");
    expect(result).toMatchObject({
      ok: false,
      reason: "invalid-frontmatter",
    });
  });

  it("fails when frontmatter root is not a mapping", async () => {
    const path = await write("post.md", "---\n- one\n- two\n---\nbody\n");
    const result = await parseItem(path, "markdown-frontmatter");
    expect(result).toMatchObject({
      ok: false,
      reason: "invalid-frontmatter",
    });
  });
});

describe("parseItem (json)", () => {
  it("parses a JSON object", async () => {
    const path = await write("note.json", '{"id":"abc","tags":["x"]}');
    const result = await parseItem(path, "json");
    expect(result).toEqual({
      ok: true,
      data: { id: "abc", tags: ["x"] },
    });
  });

  it("rejects array at root", async () => {
    const path = await write("note.json", "[1,2,3]");
    const result = await parseItem(path, "json");
    expect(result).toMatchObject({ ok: false, reason: "non-object" });
  });

  it("reports invalid JSON", async () => {
    const path = await write("note.json", "{not json");
    const result = await parseItem(path, "json");
    expect(result).toMatchObject({ ok: false, reason: "invalid-json" });
  });
});

describe("parseItem (yaml)", () => {
  it("parses a YAML mapping", async () => {
    const path = await write("note.yaml", "id: abc\ntags:\n  - x\n");
    const result = await parseItem(path, "yaml");
    expect(result).toEqual({
      ok: true,
      data: { id: "abc", tags: ["x"] },
    });
  });

  it("rejects scalar at root", async () => {
    const path = await write("note.yaml", "just-a-string\n");
    const result = await parseItem(path, "yaml");
    expect(result).toMatchObject({ ok: false, reason: "non-object" });
  });

  it("reports invalid YAML", async () => {
    const path = await write("note.yaml", "key: [unclosed\n");
    const result = await parseItem(path, "yaml");
    expect(result).toMatchObject({ ok: false, reason: "invalid-yaml" });
  });
});

describe("parseItem (read errors)", () => {
  it("returns read-error when the file does not exist", async () => {
    const result = await parseItem(join(dir, "missing.md"), "markdown-frontmatter");
    expect(result).toMatchObject({ ok: false, reason: "read-error" });
  });
});
