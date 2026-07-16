import { readFile } from "node:fs/promises";

const EVENT_TYPES = new Set(["input", "claim", "command", "artifact", "risk", "verdict"]);

export async function loadJson(path) {
  const raw = await readFile(path, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${error.message}`);
  }
}

export function normalizeRun(input, artifactInput = null) {
  const events = Array.isArray(input) ? input : input.events;
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
    `# Evidence Trail: ${packet.runId}`,
    "",
    `Verdict: ${packet.verdict ? packet.verdict.classification : "missing"}`,
    packet.verdict?.reason ? `Reason: ${packet.verdict.reason}` : "",
    ""
  ].filter(Boolean);

  appendSection(lines, "Inputs", packet.inputs.map((item) => `- ${item.label || "input"}: ${item.value || item.summary || ""}`));
  appendSection(lines, "Claims", packet.claims.map((claim) => `- ${claim.id || "claim"}: ${claim.text}${claim.evidence?.length ? ` (evidence: ${claim.evidence.join(", ")})` : ""}`));
  appendSection(lines, "Commands", packet.commands.map((cmd) => `- ${cmd.status || "unknown"}: \`${cmd.command || cmd.id || "command"}\`${Number.isInteger(cmd.exitCode) ? ` exit ${cmd.exitCode}` : ""}${cmd.summary ? ` - ${cmd.summary}` : ""}`));
  appendSection(lines, "Artifacts", packet.artifacts.map((artifact) => `- ${artifact.path || artifact.url || "artifact"}${artifact.description || artifact.summary ? ` - ${artifact.description || artifact.summary}` : ""}`));
  appendSection(lines, "Risks", packet.risks.map((risk) => `- ${risk.severity || "unknown"}: ${risk.text || risk.summary || ""}`));
  appendSection(lines, "Warnings", packet.warnings.map((warning) => `- ${warning}`));

  return `${lines.join("\n")}\n`;
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
  return {
    ...event,
    evidence: Array.isArray(event.evidence) ? event.evidence : event.evidence ? [String(event.evidence)] : []
  };
}

function collectArtifacts(events, artifactInput) {
  const eventArtifacts = events.filter((event) => event.type === "artifact");
  if (!artifactInput) return eventArtifacts;
  const manifest = Array.isArray(artifactInput) ? artifactInput : artifactInput.artifacts;
  if (!Array.isArray(manifest)) {
    throw new Error("Artifact input must be an array or an object with an artifacts array.");
  }
  return [...eventArtifacts, ...manifest];
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

