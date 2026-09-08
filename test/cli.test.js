import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const cliPath = join(process.cwd(), "src/cli.js");

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

test("CLI rejects a ship packet whose claim references incomplete command evidence", async () => {
  const result = await runCli([
    { type: "claim", id: "tested", text: "Tests pass", evidence: ["cmd-test"] },
    { type: "command", id: "cmd-test", status: "pass", command: "npm test" },
    { type: "verdict", classification: "ship" }
  ], ["--format", "json"]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /skill-evidence-trail: Event 1 command exitCode must be an integer\./);
  assert.doesNotMatch(result.stdout, /"warnings": \[\]/);
});

test("CLI rejects a ship packet with an anonymous passing command", async () => {
  const result = await runCli([
    { type: "command", id: " ", command: "\t", status: "pass", exitCode: 0 },
    { type: "verdict", classification: "ship" }
  ], ["--format", "json"]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /skill-evidence-trail: Event 0 command must include a non-empty command or id\./);
  assert.doesNotMatch(result.stdout, /"warnings": \[\]/);
});

test("CLI reports inconsistent command status using the zero-based event index", async () => {
  const result = await runCli([
    { type: "input", label: "request", value: "demo" },
    { type: "command", id: "cmd-test", status: "pass", command: "npm test", exitCode: 2 },
    { type: "verdict", classification: "blocked" }
  ], ["--format", "json"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /skill-evidence-trail: Event 1 command status pass requires exitCode 0\./);
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

test("CLI rejects an output path that aliases the run input", async () => {
  const directory = await mkdtemp(join(tmpdir(), "skill-evidence-trail-run-alias-test-"));
  const run = join(directory, "run.json");
  const source = '{"events":[]}\n';
  await writeFile(run, source);

  const result = spawnSync(
    process.execPath,
    [cliPath, "run.json", "--out", run],
    { cwd: directory, encoding: "utf8" }
  );

  assert.equal(result.status, 1);
  assert.equal(result.stderr, "skill-evidence-trail: --out must not overwrite the run input.\n");
  assert.equal(await readFile(run, "utf8"), source);
});

test("CLI rejects an output path that aliases the artifact input", async () => {
  const directory = await mkdtemp(join(tmpdir(), "skill-evidence-trail-artifact-alias-test-"));
  const run = join(directory, "run.json");
  const artifacts = join(directory, "artifacts.json");
  const runSource = '{"events":[]}\n';
  const artifactSource = '{"artifacts":[]}\n';
  await writeFile(run, runSource);
  await writeFile(artifacts, artifactSource);

  const result = spawnSync(
    process.execPath,
    [cliPath, run, "--artifacts", "artifacts.json", "--out", artifacts],
    { cwd: directory, encoding: "utf8" }
  );

  assert.equal(result.status, 1);
  assert.equal(result.stderr, "skill-evidence-trail: --out must not overwrite the artifact input.\n");
  assert.equal(await readFile(run, "utf8"), runSource);
  assert.equal(await readFile(artifacts, "utf8"), artifactSource);
});

test("CLI writes a distinct output without changing either input", async () => {
  const directory = await mkdtemp(join(tmpdir(), "skill-evidence-trail-distinct-out-test-"));
  const run = join(directory, "run.json");
  const artifacts = join(directory, "artifacts.json");
  const output = join(directory, "evidence.md");
  const runSource = '{"events":[]}\n';
  const artifactSource = '{"artifacts":[]}\n';
  await writeFile(run, runSource);
  await writeFile(artifacts, artifactSource);

  const result = spawnSync(
    process.execPath,
    ["src/cli.js", run, "--artifacts", artifacts, "--out", output],
    { encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(await readFile(output, "utf8"), /# Evidence Trail:/);
  assert.equal(await readFile(run, "utf8"), runSource);
  assert.equal(await readFile(artifacts, "utf8"), artifactSource);
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
