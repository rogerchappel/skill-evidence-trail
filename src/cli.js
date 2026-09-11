#!/usr/bin/env node
import { stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadJson, normalizeRun, renderJson, renderMarkdown } from "./index.js";

const args = process.argv.slice(2);

if (args.includes("--help") || args.length === 0) {
  console.log(`Usage: skill-evidence-trail <run.json> [--artifacts artifacts.json] [--format markdown|json] [--out path]`);
  process.exit(args.length === 0 ? 1 : 0);
}

const runPath = args[0];

try {
  const options = parseOptions(args.slice(1));
  await validateOutputPath(runPath, options);
  const run = await loadJson(runPath);
  const artifacts = options.artifacts ? await loadJson(options.artifacts) : undefined;
  const packet = normalizeRun(run, artifacts);
  const output = options.format === "json" ? renderJson(packet) : renderMarkdown(packet);
  if (options.out) {
    await writeFile(options.out, output);
  } else {
    process.stdout.write(output);
  }
} catch (error) {
  console.error(`skill-evidence-trail: ${error.message}`);
  process.exit(1);
}

async function validateOutputPath(runPath, options) {
  if (!options.out) return;

  const outputPath = resolve(options.out);
  const runInputPath = resolve(runPath);
  const artifactInputPath = options.artifacts ? resolve(options.artifacts) : null;

  if (samePathText(outputPath, runInputPath)) {
    throw new Error("--out must not overwrite the run input.");
  }
  if (artifactInputPath && samePathText(outputPath, artifactInputPath)) {
    throw new Error("--out must not overwrite the artifact input.");
  }

  const outputStat = await statIfExists(outputPath);
  if (!outputStat) return;

  if (await isSameFile(outputStat, runInputPath)) {
    throw new Error("--out must not overwrite the run input.");
  }
  if (artifactInputPath && (await isSameFile(outputStat, artifactInputPath))) {
    throw new Error("--out must not overwrite the artifact input.");
  }
}

// On case-insensitive filesystems (macOS defaults, Windows) two paths that
// differ only in letter case name the same file, so textual comparison is
// case-folded in addition to the exact comparison. On case-sensitive
// filesystems this only rejects a narrower, safe-side superset.
function samePathText(left, right) {
  return left === right || left.toLowerCase() === right.toLowerCase();
}

// Symlinked and hard-linked output paths share the run or artifact input's
// underlying file, so identity is resolved to the filesystem-level
// (device, inode) pair instead of the path text.
async function isSameFile(outputStat, inputPath) {
  const inputStat = await statIfExists(inputPath);
  return Boolean(inputStat && inputStat.dev === outputStat.dev && inputStat.ino === outputStat.ino);
}

async function statIfExists(path) {
  try {
    return await stat(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function parseOptions(tokens) {
  const options = { format: "markdown", out: null, artifacts: null };
  const seen = new Set();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (["--format", "--out", "--artifacts"].includes(token)) {
      if (seen.has(token)) throw new Error(`${token} may only be specified once.`);
      seen.add(token);
    }
    if (token === "--format") options.format = readValue(tokens, ++index, token);
    else if (token === "--out") options.out = readValue(tokens, ++index, token);
    else if (token === "--artifacts") options.artifacts = readValue(tokens, ++index, token);
    else throw new Error(`Unknown option: ${token}`);
  }
  if (!["markdown", "json"].includes(options.format)) {
    throw new Error("--format must be markdown or json.");
  }
  return options;
}

function readValue(tokens, index, flag) {
  if (!tokens[index]) throw new Error(`${flag} requires a value.`);
  return tokens[index];
}
