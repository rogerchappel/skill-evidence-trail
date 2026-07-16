# Orchestration

`skill-evidence-trail` is designed for local automation lanes.

1. Generate or collect a JSON run event file.
2. Optionally generate an artifact manifest.
3. Run the CLI in read-only mode first.
4. Write the report with `--out` only after reviewing the destination.
5. Include command results in release-candidate PR bodies.

The tool never executes commands from the event log.

