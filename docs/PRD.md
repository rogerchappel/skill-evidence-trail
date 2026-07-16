# PRD: skill-evidence-trail

## Summary

Build a local-first CLI that turns agent skill run fixtures into evidence
packets with inputs, claims, checks, artifacts, risks, and a readiness verdict.

## Users

- Agent builders preparing release-candidate PRs.
- Maintainers reviewing skill outputs.
- Automation lanes that need concise evidence trails.

## MVP

- Parse local JSON run events.
- Merge optional artifact manifests.
- Emit Markdown and JSON reports.
- Flag missing verification, unresolved risks, and weak verdicts.
- Provide fixtures, tests, smoke command, and reusable `SKILL.md`.

## Non-Goals

- Live connector calls.
- LLM-based judging.
- Hosted evidence storage.

