import { describe, expect, it } from "vitest";
import { applyProjection } from "../src/emit/projection.js";

describe("applyProjection", () => {
  it("picks listed fields and drops the rest", () => {
    const data = { title: "A", date: "2024", body: "x", extra: 1 };
    expect(applyProjection(data, ["title", "date"])).toEqual({
      title: "A",
      date: "2024",
    });
  });

  it("preserves explicit null values", () => {
    expect(applyProjection({ a: null, b: 1 }, ["a"])).toEqual({ a: null });
  });

  it("omits missing fields without throwing", () => {
    expect(applyProjection({ a: 1 }, ["a", "b"])).toEqual({ a: 1 });
  });

  it("returns empty object for empty projection", () => {
    expect(applyProjection({ a: 1 }, [])).toEqual({});
  });
});
