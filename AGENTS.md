# AGENTS.md

Notes for AI agents (and humans) working on this codebase.

## What this is

A TypeScript CLI + GitHub Action that turns a directory of structured content
(Markdown w/ frontmatter, JSON, YAML) into a public index and optional
`llms.txt` / `README.md`. Driven by a single `repo-db.yaml`. Validation is
ESLint-style: each rule has `error | warn | off` severity, with global and
per-type overrides.

## Architecture

A linear pipeline, four stages:

```
config/load → content/discover → validation/runner → emit/{indexes,llms,readme}
```

- `src/config/`: loads and validates `repo-db.yaml` against a Zod v4 schema.
  Owns the `RuleId` enum.
- `src/content/`: walks globs (`fast-glob`), parses items per format
  (`gray-matter` for markdown frontmatter, native for JSON, `yaml` lib for
  YAML). Returns `{ items, errors }` — parse failures don't throw.
- `src/validation/`: maps parse errors and Ajv schema errors to typed
  `Diagnostic` objects. Severities flow through `severity.ts`. Schemas and
  projections load via `JsonResourceLoader` (path or `https://` URL,
  in-memory cached).
- `src/emit/`: projects items, writes `index.json` (combined) and/or
  `<type>.json` (per-type), `llms.txt`, and an updatable section of
  `README.md` between HTML-comment markers.
- `src/pipeline.ts`: orchestrates the above for `runBuild` / `runValidate`,
  including stdin (`--config -`) support.
- `src/cli.ts`: commander wrapper. Don't put logic here — it's argv→pipeline glue.

## Commands

```bash
npm test            # vitest run, all tests
npm run typecheck   # tsc --noEmit
npm run build       # tsc -p tsconfig.build.json → dist/
npm run dev -- build --config repo-db.yaml   # run CLI from source via tsx
```

Tests live in `tests/`, mirror module names (`config.test.ts`,
`runner.test.ts`, etc.). They use `mkdtemp` for filesystem isolation —
follow that pattern for new tests that touch disk.

## Gotchas

- **Zod v4 `.default(obj)` checks the *output* type.** For an object schema
  whose fields all have inner defaults, use `.prefault({})` instead so the
  default is re-parsed through the schema. See `IndexConfig.prefault({})`
  in `src/config/schema.ts`.
- **`z.record(enum, V)` is strict in v4.** It requires every enum value as a
  key. For ESLint-style "set only the rules you care about" maps, use
  `z.partialRecord(enum, V)`.
- **Ajv ESM/CJS interop is fiddly with `module: NodeNext`.** We import
  `Ajv2020` from `ajv/dist/2020.js` for Draft 2020-12 default semantics, and
  load the Draft 7 meta-schema via JSON import attribute so schemas
  declaring `$schema: ...draft-07/schema` still pass meta-validation. For
  `ajv-formats`, see the type-narrowing helper at the top of
  `src/validation/ajv_validator.ts`.
- **YAML autoparses ISO date strings to `Date` objects.** A JSON Schema
  `type: "string"` will reject these. Document this in user-facing schemas
  and quote dates in test fixtures.
- **`unknown-fields` rule needs `additionalProperties: false` in user
  schemas.** Don't mutate user schemas at runtime to inject this — surprising
  and surprising-magic conflict with JSON Schema convention.
- **`exactOptionalPropertyTypes` is OFF.** Toggling it on breaks Zod-inferred
  types and the Ajv import dance. Don't enable.
- **Don't add `Co-Authored-By` trailers to commits.** User preference. See
  `~/.claude/projects/.../memory/feedback_no_coauthor.md`.

## Implicit projection fields

`src/emit/projection.ts` exports `IMPLICIT_FIELDS` — fields that the
projector fills from the `ContentItem` itself when listed in projection
but absent from `data`. Currently only `path`. To add another:

1. Insert it into `IMPLICIT_FIELDS`.
2. Handle it in `applyProjection`'s switch (the `if (field === "path")` block).
3. The validation runner already skips diagnostics for any field in
   `IMPLICIT_FIELDS`, so no change there.

Frontmatter values always win over implicit fallbacks.

## Adding a new rule

1. Add the ID to `RuleId` enum in `src/config/schema.ts`.
2. Add the default severity to `DEFAULT_SEVERITIES` in `src/validation/severity.ts`.
3. Implement the check in `src/validation/runner.ts` (or extend an existing
   check to call `pushDiagnostic` with the new rule).
4. Add an entry to the README rule table.
5. Add a test in `tests/runner.test.ts` covering both fire and `off` cases.

## Adding a new content format

1. Add the literal to `Format` enum in `src/config/schema.ts`.
2. Add a parser branch in `src/content/parse.ts` (return
   `{ ok: true, data, body? }` or `{ ok: false, reason, message }`).
3. If it's a new "non-object root" failure mode, route it in the runner's
   `parseFailureToRule` — match the convention of `invalid-json` /
   `invalid-yaml`.
4. Tests in `tests/parse.test.ts`.

## Don't do

- Don't introduce a global Ajv singleton or a module-level
  `JsonResourceLoader`. The runner and emit each create their own per-build
  instances; cache lifetime should never outlive a CLI invocation.
- Don't make emit dependent on validation passing. Users who want strict
  gating run `validate` first. Coupling them removes a useful operating
  mode (partial-emit on warn).
- Don't reach for ESM/CJS workarounds beyond the existing `ajv-formats`
  shim. If a new dependency's types resist `module: NodeNext`, prefer
  finding a different dependency.
