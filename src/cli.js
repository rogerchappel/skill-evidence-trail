#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { loadJson, normalizeRun, renderJson, renderMarkdown } from "./index.js";

const args = process.argv.slice(2);

if (args.includes("--help") || args.length === 0) {
  console.log(`Usage: skill-evidence-trail <run.json> [--artifacts artifacts.json] [--format markdown|json] [--out path]`);
  process.exit(args.length === 0 ? 1 : 0);
}

const runPath = args[0];
const options = parseOptions(args.slice(1));

try {
  const run = await loadJson(runPath);
  const artifacts = options.artifacts ? await loadJson(options.artifacts) : null;
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

function parseOptions(tokens) {
  const options = { format: "markdown", out: null, artifacts: null };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
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

