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

for (const [label, command, message] of [
  ["missing exit code", { type: "command", status: "pass" }, "Event 1 command exitCode must be an integer."],
  ["fractional exit code", { type: "command", status: "fail", exitCode: 1.5 }, "Event 1 command exitCode must be an integer."],
  ["unsupported status", { type: "command", status: "success", exitCode: 0 }, "Event 1 command status must be pass or fail."],
  ["passing nonzero exit", { type: "command", status: "pass", exitCode: 1 }, "Event 1 command status pass requires exitCode 0."],
  ["failing zero exit", { type: "command", status: "fail", exitCode: 0 }, "Event 1 command status fail requires a nonzero exitCode."]
]) {
  test(`rejects a command with ${label}`, () => {
    assert.throws(
      () => normalizeRun({ events: [{ type: "input" }, command] }),
      new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );
  });
}

test("retains deterministic output for valid passing and failing commands", () => {
  const packet = normalizeRun({
    events: [
      { type: "command", id: "pass", status: "pass", command: "npm test", exitCode: 0 },
      { type: "command", id: "fail", status: "fail", command: "npm run lint", exitCode: 2 },
      { type: "verdict", classification: "blocked" }
    ]
  });

  assert.deepEqual(packet.commands.map(({ status, exitCode }) => ({ status, exitCode })), [
    { status: "pass", exitCode: 0 },
    { status: "fail", exitCode: 2 }
  ]);
  assert.deepEqual(packet.warnings, ["One or more commands did not pass."]);
  assert.match(renderMarkdown(packet), /- pass: `npm test` exit 0/);
  assert.match(renderMarkdown(packet), /- fail: `npm run lint` exit 2/);
});

test("renders markdown sections", async () => {
  const packet = normalizeRun(await loadJson("fixtures/run-events.json"));
  const markdown = renderMarkdown(packet);

  assert.match(markdown, /# Evidence Trail: demo-skill-run/);
  assert.match(markdown, /## Commands/);
  assert.match(markdown, /npm test/);
});

test("renders user-controlled values without creating Markdown structure", () => {
  const packet = normalizeRun({
    runId: "demo\n## Forged run",
    events: [
      { type: "input", label: "request\n- forged input", value: "value\n# forged heading" },
      { type: "claim", id: "claim\n- forged claim", text: "safe\n## forged claim", evidence: ["cmd"] },
      { type: "command", id: "cmd", status: "pass", command: "printf `x` && echo ``y``", exitCode: 0, summary: "done\n- forged summary" },
      { type: "artifact", path: "report.md\n## forged artifact", description: "result\n- forged description" },
      { type: "risk", severity: "low\n- forged severity", text: "known\n## forged risk" },
      { type: "verdict", classification: "ship", reason: "verified\n- forged reason" }
    ]
  });

  const markdown = renderMarkdown(packet);

  assert.equal(markdown.match(/^#/gm)?.length, 7);
  assert.equal(markdown.match(/^- /gm)?.length, 6);
  assert.doesNotMatch(markdown, /^## Forged|^## forged|^- forged/gm);
  assert.match(markdown, /``` printf `x` && echo ``y`` ```/);
});
