# skill-evidence-trail

`skill-evidence-trail` turns a local agent skill run into a compact evidence
packet for PRs, handoffs, and release notes. It reads JSON fixtures, normalizes
claims and command results, and writes Markdown or JSON without calling a model
or touching external services.

## Quickstart

```bash
npm install
npm run smoke
node src/cli.js fixtures/run-events.json --artifacts fixtures/artifacts.json --format markdown
```

Before publishing, run `npm run package:check`. It inspects the generated
tarball and runs the tests, syntax check, build check, smoke command, and CLI
help directly from the unpacked artifact.

## Input

Run events may be an array or an object with an `events` array. Supported event
types are:

- `input`: user request or source artifact.
- `claim`: something the agent says is true.
- `command`: verification command with `status`, `exitCode`, and optional output.
- `artifact`: generated file or URL evidence.
- `risk`: unresolved limitation or privacy concern.
- `verdict`: final `ship`, `incubate`, or `blocked` classification.

Every `verdict` event must include one of those three classifications. Missing
or unsupported classifications stop normalization and the CLI reports the
zero-based event index so the invalid event can be corrected.

Artifact manifests are optional JSON arrays or `{ "artifacts": [...] }` objects.
Each array element must be a non-null JSON object. An artifact may identify its
location with `path` or `url` and may describe it with `description` or
`summary`; for example, `{ "path": "reports/evidence.md", "description":
"Rendered evidence packet" }`.

## CLI

```bash
skill-evidence-trail run.json --artifacts artifacts.json --format markdown --out evidence.md
skill-evidence-trail run.json --format json
```

Each option may be specified at most once. Repeating `--format`, `--artifacts`,
or `--out` is a usage error; the CLI rejects the command before reading the run
or artifact inputs and before writing output.

An `--out` path must be distinct from both the run input and the optional
artifact input. Equivalent relative and absolute paths are rejected before any
file is written, so the CLI never overwrites either source file.

## Safety

The CLI is read-only except for an explicit, non-input `--out` path. It does not
inspect agent memory, call connector APIs, upload artifacts, or infer a
successful verdict without local events.

## Limitations

- Input validation is intentionally conservative and schema-light, with strict
  validation of verdict classifications.
- Markdown reports are concise by design.
- The tool does not verify that an artifact path still exists unless it appears
  in the provided fixture data.
