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

for (const [label, input] of [
  ["null", null],
  ["an object without events", {}]
]) {
  test(`rejects ${label} as a run input`, () => {
    assert.throws(
      () => normalizeRun(input),
      /Run input must be an array or an object with an events array\./
    );
  });
}

for (const [label, input] of [
  ["null", null],
  ["an object without artifacts", {}]
]) {
  test(`rejects ${label} as an artifact input`, () => {
    assert.throws(
      () => normalizeRun([], input),
      /Artifact input must be an array or an object with an artifacts array\./
    );
  });
}

for (const [index, artifact] of [[0, null], [1, "report.md"]]) {
  test(`rejects a non-object artifact at index ${index}`, () => {
    const artifacts = index === 0 ? [artifact] : [{ path: "valid.md" }, artifact];
    assert.throws(
      () => normalizeRun([], artifacts),
      new RegExp(`Artifact ${index} must be an object\\.`)
    );
  });
}

test("retains valid array and object artifact forms", () => {
  const arrayPacket = normalizeRun([], [{ path: "array.md" }]);
  const objectPacket = normalizeRun({ runId: "object-run", events: [] }, {
    artifacts: [{ url: "https://example.test/report" }]
  });

  assert.deepEqual(arrayPacket.artifacts, [{ path: "array.md" }]);
  assert.equal(objectPacket.runId, "object-run");
  assert.deepEqual(objectPacket.artifacts, [{ url: "https://example.test/report" }]);
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
