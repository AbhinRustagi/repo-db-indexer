# repo-db-indexer

Build content indexes for git-native content repositories. Point it at a
directory of structured content (Markdown with frontmatter, JSON, or YAML),
declare per-type schemas and projections in `repo-db.yaml`, and on each push
it regenerates `index.json`, optionally `llms.txt`, and an updatable section
of `README.md`.

Designed to run two ways:

- **As a CLI** (`repo-db-indexer build`) for local development and ad-hoc use.
- **As a GitHub Action** that regenerates indexes on push and (optionally)
  commits the result back to the branch.

> Status: early. APIs and config keys may shift before 1.0. Pin to a commit
> if you depend on it.

## Install

```bash
npm install -g repo-db-indexer
```

Or use it without installing via `npx repo-db-indexer build`.

## Quick start

Create `repo-db.yaml` at the root of your content repo:

```yaml
name: my-blog
types:
  post:
    content: posts/**/*.md
    format: markdown-frontmatter
    schema: structures/post.schema.json
    projection: structures/post.index.json
    key: slug
    sort:
      field: date
      order: desc
```

`structures/post.schema.json` is a JSON Schema describing the full item shape:

```json
{
  "type": "object",
  "required": ["title", "slug", "date"],
  "additionalProperties": false,
  "properties": {
    "title":  { "type": "string" },
    "slug":   { "type": "string" },
    "date":   { "type": "string", "format": "date" },
    "tags":   { "type": "array", "items": { "type": "string" } }
  }
}
```

`structures/post.index.json` is the projection — the subset of fields that
ends up in the public index:

```json
["title", "slug", "date", "tags"]
```

Run:

```bash
repo-db-indexer build
```

Outputs `index.json` at the repo root, with one key per content type.

## Configuration

See [`config.example.yaml`](./config.example.yaml) for an annotated full
example. Key fields:

| Key                        | Default      | Notes                                                              |
| -------------------------- | ------------ | ------------------------------------------------------------------ |
| `name`                     | (required)   | Used in `llms.txt` / generated README headings.                    |
| `output`                   | `.`          | Directory for generated files, relative to the config file.        |
| `index.combined`           | `true`       | Write a single `index.json` keyed by type name.                    |
| `index.per_type`           | `false`      | Also write per-type files (`<type>.json`).                         |
| `types.<name>.content`     | (required)   | Glob, relative to config dir.                                      |
| `types.<name>.format`      | (required)   | `markdown-frontmatter` \| `json` \| `yaml`.                        |
| `types.<name>.schema`      | (required)   | Path or `https://` URL to a JSON Schema file.                      |
| `types.<name>.projection`  | (required)   | Path or `https://` URL to a JSON array of field names.             |
| `types.<name>.key`         | (required)   | Field used for duplicate detection.                                |
| `types.<name>.sort`        | (none)       | `{ field, order: asc \| desc }`.                                   |
| `types.<name>.index`       | (none)       | Override per-type output filename.                                 |
| `llms`                     | `false`      | Also emit `llms.txt`.                                              |
| `update_readme`            | `false`      | Regenerate the section between `repo-db-indexer:start/end` markers in `README.md`. |

### Validation rules

ESLint-style. Set severities at the top level or per-type. Severities:
`error` (fails the build), `warn` (prints, exit 0), `off` (silent).

| Rule                  | Default | Meaning                                                |
| --------------------- | ------- | ------------------------------------------------------ |
| `read-error`          | error   | A matched file could not be read.                      |
| `invalid-frontmatter` | error   | Markdown frontmatter is malformed or not a mapping.    |
| `invalid-json`        | error   | JSON file is malformed or root is not an object.       |
| `invalid-yaml`        | error   | YAML file is malformed or root is not a mapping.       |
| `schema-violation`    | error   | Catch-all for any JSON Schema violation.               |
| `required-fields`     | error   | A required field is missing (Ajv `required`).          |
| `type-mismatch`       | error   | Field is the wrong type (Ajv `type`).                  |
| `unknown-fields`      | warn    | Field present that the schema doesn't allow (Ajv `additionalProperties`). Requires `additionalProperties: false` in your schema. |
| `duplicate-key`       | error   | Two items share the same value for the type's `key`.   |
| `empty-body`          | off     | Markdown body is empty/whitespace.                     |
| `projection-missing`  | warn    | A field listed in the projection is missing from the item. |

Per-type override:

```yaml
types:
  post:
    rules:
      empty-body: error
      unknown-fields: error
```

## CLI

```
repo-db-indexer [build|validate] [options]

  -c, --config <path>   Config path or '-' for stdin (default: repo-db.yaml)
  -C, --cwd <dir>       Working directory for relative paths
```

Exit codes: `0` success, `1` validation errors, `2` runtime error.

## GitHub Action

(See `action.yml` in this repo.) Wire it up in your content repo:

```yaml
on:
  push:
    branches: [main]

permissions:
  contents: write   # only needed if commit: true

jobs:
  index:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: abhinrustagi/repo-db-indexer@v0
        with:
          # Either point to a file in the repo:
          config-path: ./repo-db.yaml
          # ...or pass it inline:
          # config: |
          #   name: my-blog
          #   types: { ... }
          commit: true   # commit regenerated index back to the branch
```

## Caveats

- **YAML autoparses dates.** `date: 2024-01-01` in frontmatter becomes a
  JavaScript `Date` object; JSON Schema `type: "string"` will reject it.
  Quote dates (`date: "2024-01-01"`) if your schema expects strings.
- **`unknown-fields` requires schema opt-in.** Set
  `"additionalProperties": false` in your JSON Schema for the rule to fire.
- **Schemas can be remote URLs** (`https://...`). They're fetched and cached
  per process; no on-disk cache yet.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build       # emits dist/
npm run dev -- build --config repo-db.yaml   # run CLI from source
```

Module layout:

```
src/
├── config/      # YAML config loader and Zod schema
├── content/     # glob walking, frontmatter/JSON/YAML parsing
├── validation/  # rule registry, Ajv runner, diagnostics, reporter
├── emit/        # projection, index files, llms.txt, README updater
├── pipeline.ts  # orchestrates all of the above
└── cli.ts       # commander-based entry
```

## License

MIT
