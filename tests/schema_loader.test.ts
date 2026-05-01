import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JsonResourceLoader } from "../src/validation/schema_loader.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "repo-db-loader-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("JsonResourceLoader (filesystem)", () => {
  it("loads JSON from a relative path", async () => {
    await writeFile(join(dir, "schema.json"), '{"type":"object"}', "utf8");
    const loader = new JsonResourceLoader();
    const result = await loader.load("schema.json", dir);
    expect(result).toEqual({ type: "object" });
  });

  it("caches by resolved path so subsequent reads hit cache", async () => {
    const path = join(dir, "schema.json");
    await writeFile(path, '{"v":1}', "utf8");
    const loader = new JsonResourceLoader();
    const first = await loader.load("schema.json", dir);

    await writeFile(path, '{"v":2}', "utf8");
    const second = await loader.load("schema.json", dir);

    expect(first).toEqual({ v: 1 });
    expect(second).toEqual({ v: 1 });
  });

  it("throws on invalid JSON with the file path in the message", async () => {
    await writeFile(join(dir, "bad.json"), "{not json", "utf8");
    const loader = new JsonResourceLoader();
    await expect(loader.load("bad.json", dir)).rejects.toThrow(
      /Invalid JSON in .*bad\.json/
    );
  });
});

describe("JsonResourceLoader (URL)", () => {
  it("fetches JSON over https and caches the result", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response('{"type":"object"}', {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );

    const loader = new JsonResourceLoader();
    const url = "https://example.com/schema.json";
    const a = await loader.load(url, dir);
    const b = await loader.load(url, dir);
    expect(a).toEqual({ type: "object" });
    expect(b).toEqual({ type: "object" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("throws when the remote returns non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not found", { status: 404, statusText: "Not Found" })
    );
    const loader = new JsonResourceLoader();
    await expect(
      loader.load("https://example.com/missing.json", dir)
    ).rejects.toThrow(/Failed to fetch.*404/);
  });
});
