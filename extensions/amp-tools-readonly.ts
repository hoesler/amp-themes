/**
 * Renderers for the read-only built-in tools: read, grep, find, ls.
 *
 * Each tool exposes a `render<Tool>Call(args, theme, context)` and a
 * `render<Tool>Result(result, options, theme, context)`. Headers are built from
 * `args.path` (and tool-specific extras); results read output via
 * `extractTextOutput` and honour `options.expanded`, appending a muted
 * truncation hint when the tool's details report a limit/truncation.
 */
import type {
  AgentToolResult,
  FindToolDetails,
  FindToolInput,
  GrepToolDetails,
  GrepToolInput,
  LsToolDetails,
  LsToolInput,
  ReadToolDetails,
  ReadToolInput,
  Theme,
  ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";
import { getConfig } from "./amp-tool-config.js";
import {
  buildHeaderLine,
  extractTextOutput,
  getExpandedPreviewLineLimit,
  previewLines,
  shortenPath,
  splitLines,
  truncationHint,
  verbFor,
  type AmpToolRenderContext,
} from "./amp-tool-render.js";

/**
 * Shared result body: header verb, the output preview honouring expansion, a
 * `… (N more lines)` hint when collapsed, and an optional truncation hint.
 */
function buildResultText(
  verb: string,
  output: string,
  options: ToolRenderResultOptions,
  theme: Theme,
  truncation: string,
): string {
  const config = getConfig();
  const lines = splitLines(output);
  const limit = options.expanded
    ? getExpandedPreviewLineLimit(lines, config)
    : config.previewLines;
  const { shown, remaining } = previewLines(lines, limit);

  const parts: string[] = [];
  if (shown.length > 0) {
    parts.push(theme.fg("toolOutput", shown.join("\n")));
  }
  if (remaining > 0) {
    parts.push(theme.fg("muted", `… (${remaining} more line${remaining === 1 ? "" : "s"})`));
  }
  if (truncation) {
    parts.push(truncation);
  }
  if (parts.length === 0) {
    parts.push(theme.fg("muted", `${verb}: no output`));
  }
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// read
// ---------------------------------------------------------------------------

export function renderReadCall(
  args: ReadToolInput,
  theme: Theme,
  _context: AmpToolRenderContext,
): Component {
  const path = shortenPath(args.path);
  let range = "";
  if (typeof args.offset === "number" || typeof args.limit === "number") {
    const from = typeof args.offset === "number" ? args.offset : 0;
    const to =
      typeof args.limit === "number" ? from + args.limit : undefined;
    range = to !== undefined ? `:${from}-${to}` : `:${from}-`;
  }
  const verbPart = buildHeaderLine(verbFor("read"), path, "", theme);
  const text = range ? `${verbPart}${theme.fg("warning", range)}` : verbPart;
  return new Text(text);
}

export function renderReadResult(
  result: AgentToolResult<ReadToolDetails | undefined>,
  options: ToolRenderResultOptions,
  theme: Theme,
  _context: AmpToolRenderContext,
): Component {
  const truncation = truncationHint(result.details ?? undefined, theme);
  return new Text(buildResultText("read", extractTextOutput(result), options, theme, truncation));
}

// ---------------------------------------------------------------------------
// grep
// ---------------------------------------------------------------------------

export function renderGrepCall(
  args: GrepToolInput,
  theme: Theme,
  _context: AmpToolRenderContext,
): Component {
  const scope = shortenPath(args.path) || ".";
  let suffix = ` in ${scope}`;
  if (args.glob) {
    suffix += ` (${args.glob})`;
  }
  if (typeof args.limit === "number") {
    suffix += ` limit ${args.limit}`;
  }
  const text = buildHeaderLine(verbFor("grep"), `/${args.pattern}/`, suffix, theme);
  return new Text(text);
}

export function renderGrepResult(
  result: AgentToolResult<GrepToolDetails | undefined>,
  options: ToolRenderResultOptions,
  theme: Theme,
  _context: AmpToolRenderContext,
): Component {
  const truncation = truncationHint(result.details ?? undefined, theme);
  return new Text(buildResultText("grep", extractTextOutput(result), options, theme, truncation));
}

// ---------------------------------------------------------------------------
// find
// ---------------------------------------------------------------------------

export function renderFindCall(
  args: FindToolInput,
  theme: Theme,
  _context: AmpToolRenderContext,
): Component {
  const scope = shortenPath(args.path) || ".";
  let suffix = ` in ${scope}`;
  if (typeof args.limit === "number") {
    suffix += ` (limit ${args.limit})`;
  }
  const text = buildHeaderLine(verbFor("find"), args.pattern, suffix, theme);
  return new Text(text);
}

export function renderFindResult(
  result: AgentToolResult<FindToolDetails | undefined>,
  options: ToolRenderResultOptions,
  theme: Theme,
  _context: AmpToolRenderContext,
): Component {
  const truncation = truncationHint(result.details ?? undefined, theme);
  return new Text(buildResultText("find", extractTextOutput(result), options, theme, truncation));
}

// ---------------------------------------------------------------------------
// ls
// ---------------------------------------------------------------------------

export function renderLsCall(
  args: LsToolInput,
  theme: Theme,
  _context: AmpToolRenderContext,
): Component {
  const scope = shortenPath(args.path) || ".";
  let suffix = "";
  if (typeof args.limit === "number") {
    suffix = ` (limit ${args.limit})`;
  }
  const text = buildHeaderLine(verbFor("ls"), scope, suffix, theme);
  return new Text(text);
}

export function renderLsResult(
  result: AgentToolResult<LsToolDetails | undefined>,
  options: ToolRenderResultOptions,
  theme: Theme,
  _context: AmpToolRenderContext,
): Component {
  const truncation = truncationHint(result.details ?? undefined, theme);
  return new Text(buildResultText("ls", extractTextOutput(result), options, theme, truncation));
}
