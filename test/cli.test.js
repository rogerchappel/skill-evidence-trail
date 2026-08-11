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

async function runCli(events) {
  const directory = await mkdtemp(join(tmpdir(), "skill-evidence-trail-test-"));
  const fixture = join(directory, "run.json");
  await writeFile(fixture, JSON.stringify({ events }));
  return spawnSync(process.execPath, ["src/cli.js", fixture], { encoding: "utf8" });
}
