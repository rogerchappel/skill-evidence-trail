import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const workspace = await mkdtemp(join(tmpdir(), "skill-evidence-trail-package-"));

try {
  const output = execFileSync("npm", ["pack", "--json", "--pack-destination", workspace], { encoding: "utf8" });
  const [manifest] = JSON.parse(output);
  const archive = join(workspace, manifest.filename);
  const consumer = join(workspace, "consumer");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(consumer));
  execFileSync("npm", ["init", "--yes"], { cwd: consumer, stdio: "ignore" });
  execFileSync("npm", ["install", "--ignore-scripts", archive], { cwd: consumer, stdio: "inherit" });
  const packageJson = JSON.parse(await readFile(join(consumer, "node_modules/skill-evidence-trail/package.json"), "utf8"));
  const entry = join(consumer, "consumer.mjs");
  await (await import("node:fs/promises")).writeFile(entry, [
    'import assert from "node:assert/strict";',
    'import * as api from "skill-evidence-trail";',
    'assert.equal(typeof api.normalizeRun, "function");'
  ].join("\n"));
  execFileSync("node", [entry], { cwd: consumer, stdio: "inherit" });
  const bin = packageJson.bin["skill-evidence-trail"];
  if (!bin || !(await import("node:fs/promises")).stat(join(consumer, "node_modules/skill-evidence-trail", bin))) {
    throw new Error("declared CLI binary is missing from packed artifact");
  }
  execFileSync(join(consumer, "node_modules/.bin/skill-evidence-trail"), ["--help"], { cwd: consumer, stdio: "inherit" });
  console.log("package-check: packed consumer import and CLI verified");
} finally {
  await rm(workspace, { recursive: true, force: true });
}
