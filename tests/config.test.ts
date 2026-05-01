import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config/index.js";

async function withConfig<T>(
  yaml: string,
  fn: (path: string) => Promise<T>
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "repo-db-test-"));
  const path = join(dir, "config.yaml");
  await writeFile(path, yaml, "utf8");
  try {
    return await fn(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const minimalType = `
    content: posts/**/*.md
    format: markdown-frontmatter
    schema: structures/post.schema.json
    projection: structures/post.index.json
    key: slug`;

describe("loadConfig", () => {
  it("parses a minimal valid config and applies defaults", async () => {
    await withConfig(
      `name: test
types:
  post:${minimalType}
`,
      async (path) => {
        const cfg = await loadConfig(path);
        expect(cfg.name).toBe("test");
        expect(cfg.output).toBe(".");
        expect(cfg.index.combined).toBe(true);
        expect(cfg.index.per_type).toBe(false);
        expect(cfg.index.file).toBe("index.json");
        expect(cfg.llms).toBe(false);
        expect(cfg.update_readme).toBe(false);
        expect(cfg.types["post"]?.format).toBe("markdown-frontmatter");
      }
    );
  });

  it("rejects unknown rule ids", async () => {
    await withConfig(
      `name: test
types:
  post:${minimalType}
rules:
  not-a-real-rule: error
`,
      async (path) => {
        await expect(loadConfig(path)).rejects.toThrow(ConfigError);
      }
    );
  });

  it("rejects invalid severity values", async () => {
    await withConfig(
      `name: test
types:
  post:${minimalType}
rules:
  unknown-fields: maybe
`,
      async (path) => {
        await expect(loadConfig(path)).rejects.toThrow(/Config validation failed/);
      }
    );
  });

  it("requires at least one type", async () => {
    await withConfig(`name: test
types: {}
`, async (path) => {
      await expect(loadConfig(path)).rejects.toThrow(
        /At least one content type must be defined/
      );
    });
  });

  it("accepts per-type rule overrides", async () => {
    await withConfig(
      `name: test
types:
  post:${minimalType}
    rules:
      empty-body: error
`,
      async (path) => {
        const cfg = await loadConfig(path);
        expect(cfg.types["post"]?.rules?.["empty-body"]).toBe("error");
      }
    );
  });

  it("respects update_readme when set", async () => {
    await withConfig(
      `name: test
update_readme: true
types:
  post:${minimalType}
`,
      async (path) => {
        const cfg = await loadConfig(path);
        expect(cfg.update_readme).toBe(true);
      }
    );
  });

  it("rejects malformed YAML", async () => {
    await withConfig("name: [unclosed\n", async (path) => {
      await expect(loadConfig(path)).rejects.toThrow(/Invalid YAML/);
    });
  });

  it("throws ConfigError when file is missing", async () => {
    await expect(loadConfig("/nonexistent/repo-db/config.yaml")).rejects.toThrow(
      /Cannot read config file/
    );
  });
});
