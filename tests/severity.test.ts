import { describe, expect, it } from "vitest";
import { Config } from "../src/config/schema.js";
import { DEFAULT_SEVERITIES, severityFor } from "../src/validation/severity.js";

const baseType = {
  content: "x",
  format: "json" as const,
  schema: "x",
  projection: "x",
  key: "id",
};

describe("severityFor", () => {
  it("falls back to defaults when no config severity is set", () => {
    const cfg = Config.parse({ name: "t", types: { post: baseType } });
    expect(severityFor(cfg, cfg.types["post"]!, "empty-body")).toBe(
      DEFAULT_SEVERITIES["empty-body"]
    );
    expect(severityFor(cfg, cfg.types["post"]!, "duplicate-key")).toBe(
      "error"
    );
  });

  it("uses global rule severity when set", () => {
    const cfg = Config.parse({
      name: "t",
      types: { post: baseType },
      rules: { "empty-body": "warn" },
    });
    expect(severityFor(cfg, cfg.types["post"]!, "empty-body")).toBe("warn");
  });

  it("per-type override beats global", () => {
    const cfg = Config.parse({
      name: "t",
      types: {
        post: { ...baseType, rules: { "empty-body": "error" } },
      },
      rules: { "empty-body": "warn" },
    });
    expect(severityFor(cfg, cfg.types["post"]!, "empty-body")).toBe("error");
  });

  it("per-type 'off' overrides a stricter global", () => {
    const cfg = Config.parse({
      name: "t",
      types: {
        post: { ...baseType, rules: { "duplicate-key": "off" } },
      },
      rules: { "duplicate-key": "error" },
    });
    expect(severityFor(cfg, cfg.types["post"]!, "duplicate-key")).toBe("off");
  });
});
