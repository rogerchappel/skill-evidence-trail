import test from "node:test";
import assert from "node:assert/strict";
import { loadJson, normalizeRun, renderMarkdown } from "../src/index.js";

test("normalizes a fixture run into an evidence packet", async () => {
  const run = await loadJson("fixtures/run-events.json");
  const artifacts = await loadJson("fixtures/artifacts.json");
  const packet = normalizeRun(run, artifacts);

  assert.equal(packet.runId, "demo-skill-run");
  assert.equal(packet.commands.length, 1);
  assert.equal(packet.artifacts.length, 3);
  assert.deepEqual(packet.warnings, []);
});

test("warns when a claim has missing evidence", () => {
  const packet = normalizeRun({
    events: [
      { type: "claim", id: "undocumented", text: "A claim", evidence: ["missing-command"] },
      { type: "verdict", classification: "incubate" }
    ]
  });

  assert.match(packet.warnings.join("\n"), /missing-command/);
  assert.match(packet.warnings.join("\n"), /No verification commands/);
});

for (const classification of ["ship", "incubate", "blocked"]) {
  test(`accepts the ${classification} verdict classification`, () => {
    const packet = normalizeRun({
      events: [{ type: "verdict", classification }]
    });

    assert.equal(packet.verdict.classification, classification);
  });
}

test("rejects an unsupported verdict classification with its event index", () => {
  assert.throws(
    () => normalizeRun({ events: [{ type: "input" }, { type: "verdict", classification: "approved" }] }),
    /Event 1 has unsupported verdict classification: approved/
  );
});

test("rejects a missing verdict classification with its event index", () => {
  assert.throws(
    () => normalizeRun({ events: [{ type: "verdict" }] }),
    /Event 0 is missing a verdict classification/
  );
});

test("renders markdown sections", async () => {
  const packet = normalizeRun(await loadJson("fixtures/run-events.json"));
  const markdown = renderMarkdown(packet);

  assert.match(markdown, /# Evidence Trail: demo-skill-run/);
  assert.match(markdown, /## Commands/);
  assert.match(markdown, /npm test/);
});
