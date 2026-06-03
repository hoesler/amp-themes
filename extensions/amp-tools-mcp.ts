/**
 * MCP tool discovery for amp-style tool rendering.
 *
 * Pi has no built-in web-search / web-fetch tool (brief §0), so the only
 * dynamic tools worth special-casing are MCP tools, which are discovered at
 * runtime via `pi.getAllTools()`.
 *
 * IMPORTANT — why we DON'T re-render MCP tools:
 * The only way to attach a custom renderer is `pi.registerTool(def)`, which
 * requires a FULL `ToolDefinition` (including `execute`). But `getAllTools()`
 * returns `ToolInfo`, which is `Pick<ToolDefinition, "name"|"description"|
 * "parameters"|"promptGuidelines"> & { sourceInfo }` — it has NO `execute`.
 * The registry is last-write-wins by name, so registering a definition with a
 * stubbed `execute` would CLOBBER the real MCP tool's execution at runtime.
 * There is no renderer-only registration API and no `getRegisteredTool` to
 * chain from (brief R5). So MCP tools intentionally keep Pi's DEFAULT renderer;
 * re-rendering them safely is not possible with the current extension API.
 *
 * This module therefore performs safe, idempotent DISCOVERY only: it surveys
 * MCP candidates (deduped, repeatable, guarded by try/catch per brief R6) and
 * rebuilds a display label for each (since `ToolInfo` lacks `label`). The
 * survey is exposed for potential UI/diagnostic use and so the wiring point in
 * `amp-tool-display.ts` has a single, stable entry to call on both
 * `session_start` and `before_agent_start`.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AmpToolConfig } from "./amp-tool-config.js";

/** Minimal shape of a `ToolInfo` entry returned by `pi.getAllTools()`. */
interface ToolInfoLike {
  name?: unknown;
  description?: unknown;
  sourceInfo?: { source?: unknown; origin?: unknown } | null;
}

/** A discovered MCP tool with a rebuilt display label. */
export interface McpToolSurveyEntry {
  /** Tool name as reported by `getAllTools()` (e.g. `mcp__server__tool`). */
  name: string;
  /** Display label rebuilt as `MCP <target>` (ToolInfo has no `label`). */
  label: string;
  /** The tool's description, if any. */
  description: string;
}

/**
 * Decide whether a tool looks like an MCP tool.
 *
 * The brief's `name === "mcp"` / `/\bmcp\b/` heuristic does not match the real
 * convention: this environment exposes MCP tools as `mcp__<server>__<tool>`,
 * where `_` is a word char so there is no `\bmcp\b` boundary. We therefore
 * match the actual `mcp__` name prefix first, and keep the description and bare
 * `mcp` checks as a defensive fallback for other naming schemes.
 */
export function isMcpCandidate(name: string, description: string): boolean {
  if (name.startsWith("mcp__") || name === "mcp") {
    return true;
  }
  if (/(^|[^a-z0-9])mcp([^a-z0-9]|$)/i.test(name)) {
    return true;
  }
  return /(^|[^a-z0-9])mcp([^a-z0-9]|$)/i.test(description);
}

/**
 * Build a display label for an MCP tool. `mcp__<server>__<tool>` becomes
 * `MCP <server>/<tool>`; anything else becomes `MCP <name>`.
 */
export function buildMcpLabel(name: string): string {
  if (name.startsWith("mcp__")) {
    const rest = name.slice("mcp__".length);
    const target = rest.split("__").filter(Boolean).join("/");
    return target ? `MCP ${target}` : "MCP";
  }
  return `MCP ${name}`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Survey the currently-registered tools for MCP candidates, deduped by name.
 *
 * Safe to call repeatedly (idempotent — it allocates a fresh result each time)
 * and never throws: `getAllTools()` is wrapped in try/catch (brief R6) so a
 * discovery failure degrades to an empty survey rather than breaking startup.
 */
export function surveyMcpTools(pi: ExtensionAPI): McpToolSurveyEntry[] {
  let tools: ToolInfoLike[];
  try {
    tools = pi.getAllTools() as ToolInfoLike[];
  } catch {
    return [];
  }
  if (!Array.isArray(tools)) {
    return [];
  }

  const seen = new Set<string>();
  const entries: McpToolSurveyEntry[] = [];
  for (const tool of tools) {
    const name = asString(tool?.name);
    if (!name || seen.has(name)) {
      continue;
    }
    const description = asString(tool?.description);
    if (!isMcpCandidate(name, description)) {
      continue;
    }
    seen.add(name);
    entries.push({ name, label: buildMcpLabel(name), description });
  }
  return entries;
}

/**
 * Discover MCP tools. Wired on both `session_start` and `before_agent_start`
 * (deduped, idempotent) so the survey reflects tools added after startup.
 *
 * Re-registering MCP tools to attach a renderer is unsafe (see the module
 * header), so this performs discovery only — MCP tools keep Pi's default
 * renderer. The `getConfig` accessor is accepted for parity with the other
 * tool modules and to gate discovery should config grow a per-tool flag.
 */
export function registerMcpTools(
  pi: ExtensionAPI,
  getConfig: () => AmpToolConfig,
): McpToolSurveyEntry[] {
  const config = getConfig();
  if (config.tools.mcp === false) {
    return [];
  }
  return surveyMcpTools(pi);
}
