import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const requiredFiles = [
  "package.json",
  "LICENSE",
  "README.md",
  "SKILL.md",
  "fixtures/artifacts.json",
  "fixtures/run-events.json",
  "scripts/build-check.js",
  "scripts/package-check.js",
  "scripts/validate.sh",
  "src/cli.js",
  "src/index.js",
  "test/evidence.test.js"
];

const workspace = await mkdtemp(join(tmpdir(), "skill-evidence-trail-package-"));

try {
  const packOutput = execFileSync(
    "npm",
    ["pack", "--json", "--pack-destination", workspace],
    { encoding: "utf8" }
  );
  const [manifest] = JSON.parse(packOutput);
  const packedFiles = new Set(manifest.files.map(({ path }) => path));
  const missing = requiredFiles.filter((path) => !packedFiles.has(path));

  if (missing.length > 0) {
    throw new Error(`package is missing required files: ${missing.join(", ")}`);
  }

  const archive = resolve(workspace, manifest.filename);
  execFileSync("tar", ["-xzf", archive, "-C", workspace]);
  const packageDir = join(workspace, "package");
  const packageJson = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));

  for (const command of ["test", "check", "build", "smoke"]) {
    if (!packageJson.scripts[command]) {
      throw new Error(`package.json is missing the ${command} script`);
    }
    execFileSync("npm", ["run", command], { cwd: packageDir, stdio: "inherit" });
  }

  execFileSync("node", ["src/cli.js", "--help"], {
    cwd: packageDir,
    stdio: "inherit"
  });
  console.log(`package-check: ${packedFiles.size} files verified from packed artifact`);
} finally {
  await rm(workspace, { recursive: true, force: true });
}
