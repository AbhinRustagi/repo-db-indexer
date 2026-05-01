import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runBuild, runValidate, type PipelineLogger } from "../src/pipeline.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "repo-db-pipeline-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function write(rel: string, content: string) {
  const full = join(dir, rel);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, "utf8");
}

function captureLogger() {
  const info: string[] = [];
  const errors: string[] = [];
  const logger: PipelineLogger = {
    info: (m) => info.push(m),
    error: (m) => errors.push(m),
  };
  return { logger, info, errors };
}

const postSchema = {
  type: "object",
  required: ["title", "slug"],
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    slug: { type: "string" },
    date: { type: "string" },
  },
};

const postProjection = ["title", "slug", "date"];

const baseConfigYaml = `
name: blog
types:
  post:
    content: posts/**/*.md
    format: markdown-frontmatter
    schema: schemas/post.schema.json
    projection: schemas/post.index.json
    key: slug
`;

async function setup(configYaml: string = baseConfigYaml) {
  await write("repo-db.yaml", configYaml);
  await write("schemas/post.schema.json", JSON.stringify(postSchema));
  await write("schemas/post.index.json", JSON.stringify(postProjection));
}

describe("runBuild", () => {
  it("writes index.json and exits 0 on a clean repo", async () => {
    await setup();
    await write(
      "posts/a.md",
      "---\ntitle: A\nslug: a\ndate: \"2024-01-01\"\n---\nbody\n"
    );

    const { logger, errors } = captureLogger();
    const code = await runBuild({ config: "repo-db.yaml", cwd: dir }, logger);
    expect(code).toBe(0);
    expect(errors).toEqual([]);

    const indexJson = JSON.parse(await readFile(join(dir, "index.json"), "utf8"));
    expect(indexJson.post).toEqual([
      { title: "A", slug: "a", date: "2024-01-01" },
    ]);
  });

  it("returns 1 and skips emit when validation fails", async () => {
    await setup();
    await write("posts/bad.md", "---\ntitle: A\n---\nbody\n");

    const { logger, errors } = captureLogger();
    const code = await runBuild({ config: "repo-db.yaml", cwd: dir }, logger);
    expect(code).toBe(1);
    expect(errors.join("\n")).toMatch(/required-fields/);
    await expect(stat(join(dir, "index.json"))).rejects.toThrow();
  });

  it("emits llms.txt when configured", async () => {
    await setup(baseConfigYaml + "\nllms: true\n");
    await write(
      "posts/a.md",
      "---\ntitle: A\nslug: a\ndate: \"2024-01-01\"\n---\nbody\n"
    );

    const { logger } = captureLogger();
    const code = await runBuild({ config: "repo-db.yaml", cwd: dir }, logger);
    expect(code).toBe(0);
    const llms = await readFile(join(dir, "llms.txt"), "utf8");
    expect(llms).toContain("# blog");
    expect(llms).toContain("- A");
  });
});

describe("runValidate", () => {
  it("does not write any files even when valid", async () => {
    await setup();
    await write(
      "posts/a.md",
      "---\ntitle: A\nslug: a\ndate: \"2024-01-01\"\n---\nbody\n"
    );

    const { logger } = captureLogger();
    const code = await runValidate({ config: "repo-db.yaml", cwd: dir }, logger);
    expect(code).toBe(0);
    await expect(stat(join(dir, "index.json"))).rejects.toThrow();
  });

  it("returns 1 when validation fails", async () => {
    await setup();
    await write("posts/bad.md", "---\ntitle: A\n---\nbody\n");

    const { logger, errors } = captureLogger();
    const code = await runValidate({ config: "repo-db.yaml", cwd: dir }, logger);
    expect(code).toBe(1);
    expect(errors.length).toBeGreaterThan(0);
  });
});
