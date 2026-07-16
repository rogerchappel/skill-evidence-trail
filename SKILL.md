# Skill Evidence Trail

Use this skill when an agent run needs a reviewable evidence packet before a PR,
release candidate, handoff, or public summary.

## Required Inputs

- A local JSON file containing run events.
- Optional artifact manifest JSON.
- A destination path only when a file should be written.

## Side-Effect Boundaries

- Read local fixture files.
- Write only the explicit `--out` report path.
- Do not call external services, read private memory, or execute connector
  actions.

## Workflow

1. Collect input, claim, command, artifact, risk, and verdict events.
2. Run `skill-evidence-trail run.json --artifacts artifacts.json --format markdown`.
3. Review warnings for missing commands, uncovered claims, and unresolved risks.
4. Paste the packet into the PR body or release-candidate notes.

## Approval Requirements

No approval is needed for local read-only analysis. Ask before writing outside
the current repository or before sharing reports publicly.

## Verification

Run `npm test`, `npm run check`, `npm run build`, `npm run smoke`, and
`bash scripts/validate.sh`.

