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

## Input

Run events may be an array or an object with an `events` array. Supported event
types are:

- `input`: user request or source artifact.
- `claim`: something the agent says is true.
- `command`: verification command with `status`, `exitCode`, and optional output.
- `artifact`: generated file or URL evidence.
- `risk`: unresolved limitation or privacy concern.
- `verdict`: final `ship`, `incubate`, or `blocked` classification.

Artifact manifests are optional JSON arrays or `{ "artifacts": [...] }` objects.

## CLI

```bash
skill-evidence-trail run.json --artifacts artifacts.json --format markdown --out evidence.md
skill-evidence-trail run.json --format json
```

## Safety

The CLI is read-only except for an explicit `--out` path. It does not inspect
agent memory, call connector APIs, upload artifacts, or infer a successful
verdict without local events.

## Limitations

- Input validation is intentionally conservative and schema-light.
- Markdown reports are concise by design.
- The tool does not verify that an artifact path still exists unless it appears
  in the provided fixture data.

