import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

for (const classification of ["ship", "incubate", "blocked"]) {
  test(`CLI accepts the ${classification} verdict classification`, async () => {
    const result = await runCli([{ type: "verdict", classification }]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`Verdict: ${classification}`));
  });
}

test("CLI reports an unsupported verdict classification", async () => {
  const result = await runCli([
    { type: "input", label: "request", value: "demo" },
    { type: "verdict", classification: "approved" }
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /skill-evidence-trail: Event 1 has unsupported verdict classification: approved/);
});

test("CLI reports a missing verdict classification", async () => {
  const result = await runCli([{ type: "verdict" }]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /skill-evidence-trail: Event 0 is missing a verdict classification/);
});

test("CLI reports a null run input", async () => {
  const result = await runCliInput(null);

  assert.equal(result.status, 1);
  assert.equal(result.stderr, "skill-evidence-trail: Run input must be an array or an object with an events array.\n");
});

test("CLI reports a null artifact input", async () => {
  const directory = await mkdtemp(join(tmpdir(), "skill-evidence-trail-null-artifacts-test-"));
  const artifacts = join(directory, "artifacts.json");
  await writeFile(artifacts, "null");

  const result = await runCli([], ["--artifacts", artifacts]);

  assert.equal(result.status, 1);
  assert.equal(result.stderr, "skill-evidence-trail: Artifact input must be an array or an object with an artifacts array.\n");
});

test("CLI identifies a null artifact by its zero-based index", async () => {
  const directory = await mkdtemp(join(tmpdir(), "skill-evidence-trail-invalid-artifact-test-"));
  const artifacts = join(directory, "artifacts.json");
  await writeFile(artifacts, JSON.stringify([{ path: "valid.md" }, null]));

  const result = await runCli([], ["--artifacts", artifacts]);

  assert.equal(result.status, 1);
  assert.equal(result.stderr, "skill-evidence-trail: Artifact 1 must be an object.\n");
});

for (const [flag, firstValue, secondValue] of [
  ["--format", "json", "markdown"],
  ["--artifacts", "first.json", "second.json"],
  ["--out", "first.md", "second.md"]
]) {
  test(`CLI rejects a duplicate ${flag} before loading input`, () => {
    const result = spawnSync(
      process.execPath,
      ["src/cli.js", "missing-run.json", flag, firstValue, flag, secondValue],
      { encoding: "utf8" }
    );

    assert.equal(result.status, 1);
    assert.equal(result.stderr, `skill-evidence-trail: ${flag} may only be specified once.\n`);
  });
}

test("CLI accepts one --format option", async () => {
  const result = await runCli([], ["--format", "json"]);

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotThrow(() => JSON.parse(result.stdout));
});

test("CLI accepts one --artifacts option", async () => {
  const directory = await mkdtemp(join(tmpdir(), "skill-evidence-trail-artifacts-test-"));
  const artifacts = join(directory, "artifacts.json");
  await writeFile(artifacts, JSON.stringify({ artifacts: [] }));

  const result = await runCli([], ["--artifacts", artifacts]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# Evidence Trail:/);
});

test("CLI accepts one --out option", async () => {
  const directory = await mkdtemp(join(tmpdir(), "skill-evidence-trail-out-test-"));
  const output = join(directory, "evidence.md");

  const result = await runCli([], ["--out", output]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
});

async function runCli(events, options = []) {
  return runCliInput({ events }, options);
}

async function runCliInput(input, options = []) {
  const directory = await mkdtemp(join(tmpdir(), "skill-evidence-trail-test-"));
  const fixture = join(directory, "run.json");
  await writeFile(fixture, JSON.stringify(input));
  return spawnSync(process.execPath, ["src/cli.js", fixture, ...options], { encoding: "utf8" });
}
