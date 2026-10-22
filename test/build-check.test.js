import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/build-check.js", import.meta.url));
const required = [
  "README.md", "SKILL.md", "docs/PRD.md", "docs/TASKS.md",
  "docs/ORCHESTRATION.md", "src/index.js", "src/cli.js",
  "fixtures/run-events.json"
];

async function runBuild(root) {
  return spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
}

test("build check succeeds when every required file exists", async () => {
  const root = await mkdtemp(join(tmpdir(), "evidence-build-pass-"));
  try {
    for (const path of required) {
      const target = join(root, path);
      await mkdir(join(target, ".."), { recursive: true });
      await writeFile(target, "fixture");
    }
    const result = await runBuild(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /8 required files present/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("build check fails when a required file is missing", async () => {
  const root = await mkdtemp(join(tmpdir(), "evidence-build-fail-"));
  try {
    for (const path of required.slice(0, -1)) {
      const target = join(root, path);
      await mkdir(join(target, ".."), { recursive: true });
      await writeFile(target, "fixture");
    }
    const result = await runBuild(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ENOENT/);
    assert.match(result.stderr, /fixtures\/run-events\.json/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
