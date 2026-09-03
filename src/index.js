import { readFile } from "node:fs/promises";

const EVENT_TYPES = new Set(["input", "claim", "command", "artifact", "risk", "verdict"]);
const VERDICT_CLASSIFICATIONS = new Set(["ship", "incubate", "blocked"]);
const COMMAND_STATUSES = new Set(["pass", "fail"]);

export async function loadJson(path) {
  const raw = await readFile(path, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${error.message}`);
  }
}

export function normalizeRun(input, artifactInput) {
  const events = Array.isArray(input) ? input : isObject(input) ? input.events : undefined;
  if (!Array.isArray(events)) {
    throw new Error("Run input must be an array or an object with an events array.");
  }

  const normalized = events.map((event, index) => normalizeEvent(event, index));
  const artifacts = collectArtifacts(normalized, artifactInput);
  const commands = normalized.filter((event) => event.type === "command");
  const claims = normalized.filter((event) => event.type === "claim");
  const risks = normalized.filter((event) => event.type === "risk");
  const verdict = [...normalized].reverse().find((event) => event.type === "verdict") || null;
  const warnings = buildWarnings({ claims, commands, risks, verdict });

  return {
    runId: input.runId || "unknown-run",
    inputs: normalized.filter((event) => event.type === "input"),
    claims,
    commands,
    artifacts,
    risks,
    verdict,
    warnings
  };
}

export function renderMarkdown(packet) {
  const lines = [
    `# Evidence Trail: ${escapeMarkdownText(packet.runId)}`,
    "",
    `Verdict: ${packet.verdict ? escapeMarkdownText(packet.verdict.classification) : "missing"}`,
    packet.verdict?.reason ? `Reason: ${escapeMarkdownText(packet.verdict.reason)}` : "",
    ""
  ].filter(Boolean);

  appendSection(lines, "Inputs", packet.inputs.map((item) => `- ${escapeMarkdownText(item.label || "input")}: ${escapeMarkdownText(item.value || item.summary || "")}`));
  appendSection(lines, "Claims", packet.claims.map((claim) => `- ${escapeMarkdownText(claim.id || "claim")}: ${escapeMarkdownText(claim.text)}${claim.evidence?.length ? ` (evidence: ${claim.evidence.map(escapeMarkdownText).join(", ")})` : ""}`));
  appendSection(lines, "Commands", packet.commands.map((cmd) => `- ${escapeMarkdownText(cmd.status || "unknown")}: ${renderCodeSpan(cmd.command || cmd.id || "command")}${Number.isInteger(cmd.exitCode) ? ` exit ${cmd.exitCode}` : ""}${cmd.summary ? ` - ${escapeMarkdownText(cmd.summary)}` : ""}`));
  appendSection(lines, "Artifacts", packet.artifacts.map((artifact) => `- ${escapeMarkdownText(artifact.path || artifact.url || "artifact")}${artifact.description || artifact.summary ? ` - ${escapeMarkdownText(artifact.description || artifact.summary)}` : ""}`));
  appendSection(lines, "Risks", packet.risks.map((risk) => `- ${escapeMarkdownText(risk.severity || "unknown")}: ${escapeMarkdownText(risk.text || risk.summary || "")}`));
  appendSection(lines, "Warnings", packet.warnings.map((warning) => `- ${escapeMarkdownText(warning)}`));

  return `${lines.join("\n")}\n`;
}

function escapeMarkdownText(value) {
  return String(value ?? "")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/([`*_[\]<>])/g, "\\$1");
}

function renderCodeSpan(value) {
  const content = String(value ?? "").replace(/\r?\n|\r/g, " ");
  const longestRun = Math.max(0, ...Array.from(content.matchAll(/`+/g), (match) => match[0].length));
  const delimiter = "`".repeat(longestRun + 1);
  const padding = /^(?:`| )|(?:`| )$/.test(content) ? " " : "";
  return `${delimiter}${padding}${content}${padding}${delimiter}`;
}

export function renderJson(packet) {
  return `${JSON.stringify(packet, null, 2)}\n`;
}

function normalizeEvent(event, index) {
  if (!event || typeof event !== "object") {
    throw new Error(`Event ${index} must be an object.`);
  }
  if (!EVENT_TYPES.has(event.type)) {
    throw new Error(`Event ${index} has unsupported type: ${event.type}`);
  }
  if (event.type === "verdict" && !event.classification) {
    throw new Error(`Event ${index} is missing a verdict classification.`);
  }
  if (event.type === "verdict" && !VERDICT_CLASSIFICATIONS.has(event.classification)) {
    throw new Error(`Event ${index} has unsupported verdict classification: ${event.classification}`);
  }
  if (event.type === "command") {
    validateCommandEvent(event, index);
  }
  return {
    ...event,
    evidence: Array.isArray(event.evidence) ? event.evidence : event.evidence ? [String(event.evidence)] : []
  };
}

function validateCommandEvent(event, index) {
  if (!Number.isInteger(event.exitCode)) {
    throw new Error(`Event ${index} command exitCode must be an integer.`);
  }
  if (!COMMAND_STATUSES.has(event.status)) {
    throw new Error(`Event ${index} command status must be pass or fail.`);
  }
  if (event.status === "pass" && event.exitCode !== 0) {
    throw new Error(`Event ${index} command status pass requires exitCode 0.`);
  }
  if (event.status === "fail" && event.exitCode === 0) {
    throw new Error(`Event ${index} command status fail requires a nonzero exitCode.`);
  }
}

function collectArtifacts(events, artifactInput) {
  const eventArtifacts = events.filter((event) => event.type === "artifact");
  if (artifactInput === undefined) return eventArtifacts;
  const manifest = Array.isArray(artifactInput)
    ? artifactInput
    : isObject(artifactInput)
      ? artifactInput.artifacts
      : undefined;
  if (!Array.isArray(manifest)) {
    throw new Error("Artifact input must be an array or an object with an artifacts array.");
  }
  for (const [index, artifact] of manifest.entries()) {
    if (!isObject(artifact)) {
      throw new Error(`Artifact ${index} must be an object.`);
    }
  }
  return [...eventArtifacts, ...manifest];
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function buildWarnings({ claims, commands, risks, verdict }) {
  const warnings = [];
  const commandIds = new Set(commands.map((command) => command.id).filter(Boolean));
  for (const claim of claims) {
    if (!claim.evidence.length) warnings.push(`Claim has no evidence: ${claim.id || claim.text}`);
    for (const evidence of claim.evidence) {
      if (!commandIds.has(evidence)) warnings.push(`Claim evidence not found in commands: ${evidence}`);
    }
  }
  if (!commands.length) warnings.push("No verification commands recorded.");
  if (commands.some((command) => command.status !== "pass" || command.exitCode > 0)) warnings.push("One or more commands did not pass.");
  if (risks.some((risk) => risk.severity === "high")) warnings.push("High severity risk recorded.");
  if (!verdict) warnings.push("No final verdict event recorded.");
  return warnings;
}

function appendSection(lines, title, items) {
  lines.push(`## ${title}`, "");
  lines.push(...(items.length ? items : ["- None recorded."]));
  lines.push("");
}
