import { describe, expect, it } from "vitest";
import { applyProjection } from "../src/emit/projection.js";

const item = (data: Record<string, unknown>, path = "posts/a.md") => ({
  data,
  path,
});

describe("applyProjection", () => {
  it("picks listed fields and drops the rest", () => {
    expect(
      applyProjection(item({ title: "A", date: "2024", body: "x" }), [
        "title",
        "date",
      ])
    ).toEqual({ title: "A", date: "2024" });
  });

  it("preserves explicit null values", () => {
    expect(applyProjection(item({ a: null, b: 1 }), ["a"])).toEqual({
      a: null,
    });
  });

  it("omits missing fields without throwing", () => {
    expect(applyProjection(item({ a: 1 }), ["a", "b"])).toEqual({ a: 1 });
  });

  it("returns empty object for empty projection", () => {
    expect(applyProjection(item({ a: 1 }), [])).toEqual({});
  });

  it("fills implicit 'path' field from item.path when not in data", () => {
    expect(
      applyProjection(item({ title: "A" }, "posts/2024/a.md"), ["title", "path"])
    ).toEqual({ title: "A", path: "posts/2024/a.md" });
  });

  it("prefers data.path over item.path when both present", () => {
    expect(
      applyProjection(
        item({ path: "explicit/path.md" }, "posts/computed.md"),
        ["path"]
      )
    ).toEqual({ path: "explicit/path.md" });
  });
});
