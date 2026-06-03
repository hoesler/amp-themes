/**
 * Pure, testable shared helpers for amp-style tool rendering.
 *
 * Nothing here imports from `@earendil-works/pi-coding-agent` or `pi-tui` so the
 * functions stay trivially unit-testable. The theme is accepted via a minimal
 * structural `RenderTheme` interface which the real `Theme` class satisfies.
 */
import { homedir } from "node:os";
import type { AmpToolConfig } from "./amp-tool-config.js";

/**
 * Structural subset of the Pi `Theme` used by the renderers. The real `Theme`
 * class (with `fg(color: ThemeColor, text)`) is assignable to this because its
 * `fg` accepts a wider set of color names than the literals we pass.
 */
export interface RenderTheme {
  fg(color: string, text: string): string;
  bold(text: string): string;
}

/** Text-like content block as found in an AgentToolResult's `content` array. */
interface TextLikeContent {
  type: string;
  text?: string;
}

/** Minimal shape of a tool result we read output from. */
interface ToolResultLike {
  content?: unknown;
}

/**
 * Structural subset of Pi's `ToolRenderContext` used by our renderers.
 *
 * `ToolRenderContext` is NOT part of the package's public type surface (only
 * `ToolRenderResultOptions` is re-exported), so we describe the fields we read
 * locally. Because the context parameter of `ToolDefinition.renderCall`/
 * `renderResult` is contravariant under `strictFunctionTypes`, this interface
 * must remain a SUPERTYPE of the real context: include only fields that exist
 * on it, each typed loosely (e.g. `unknown`). That keeps our renderers
 * assignable to the real definition without importing internal types.
 */
export interface AmpToolRenderContext {
  /** Current tool call arguments (shared across call/result renders). */
  args: unknown;
  /** Shared mutable renderer state for this tool row. */
  state: unknown;
  /** Previously returned component for this render slot, if any. */
  lastComponent?: unknown;
  /** Whether the tool execution has started. */
  executionStarted: boolean;
  /** Whether the tool result is partial/streaming. */
  isPartial: boolean;
  /** Whether the current result is an error. */
  isError: boolean;
  /** Invalidate just this tool execution component for redraw. */
  invalidate: () => void;
}

// ---------------------------------------------------------------------------
// Output extraction & path helpers
// ---------------------------------------------------------------------------

/**
 * Join all `text` content blocks of a tool result into a single string.
 * Non-text blocks (e.g. images) are ignored.
 */
export function extractTextOutput(result: ToolResultLike): string {
  const rawBlocks = Array.isArray(result.content) ? result.content : [];
  const texts: string[] = [];
  for (const block of rawBlocks) {
    if (
      typeof block === "object" &&
      block !== null &&
      "type" in block &&
      (block as TextLikeContent).type === "text" &&
      typeof (block as TextLikeContent).text === "string"
    ) {
      texts.push((block as TextLikeContent).text ?? "");
    }
  }
  return texts.join("\n");
}

/** Collapse the home directory prefix of a path to `~`. */
export function shortenPath(inputPath: string | undefined): string {
  if (!inputPath) {
    return "";
  }
  const home = homedir();
  if (home && inputPath.startsWith(home)) {
    return `~${inputPath.slice(home.length)}`;
  }
  return inputPath;
}

/**
 * Count the number of lines in a block of text for display headers
 * (e.g. `wrote <path> (<N> lines)`).
 *
 * A single trailing newline is treated as the line terminator of the final
 * line, NOT as an extra empty line: `"a\nb"` and `"a\nb\n"` both count as 2.
 * Empty content counts as 0 lines.
 */
export function countLines(text: string): number {
  if (!text) {
    return 0;
  }
  const normalised = text.replace(/\r\n?/g, "\n");
  const withoutTrailingNewline = normalised.endsWith("\n")
    ? normalised.slice(0, -1)
    : normalised;
  return withoutTrailingNewline.split("\n").length;
}

/** Split text into lines, normalising CRLF and expanding tabs to 4 spaces. */
export function splitLines(text: string): string[] {
  if (!text) {
    return [];
  }
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\t/g, "    "));
}

// ---------------------------------------------------------------------------
// Preview / truncation
// ---------------------------------------------------------------------------

/**
 * Slice `lines` to at most `maxLines`, reporting how many were hidden.
 * A non-positive `maxLines` shows nothing.
 */
export function previewLines(
  lines: string[],
  maxLines: number,
): { shown: string[]; remaining: number } {
  const limit = Math.max(0, maxLines);
  const shown = lines.slice(0, limit);
  const remaining = Math.max(0, lines.length - shown.length);
  return { shown, remaining };
}

/**
 * Compute the line limit for an expanded result view.
 *
 * `config.expandedPreviewMaxLines === 0` means "show all lines"; otherwise the
 * limit is capped at the total number of available lines so the caller never
 * reports phantom "remaining" lines.
 */
export function getExpandedPreviewLineLimit(
  lines: string[],
  config: Pick<AmpToolConfig, "expandedPreviewMaxLines">,
): number {
  const max = config.expandedPreviewMaxLines;
  if (max <= 0) {
    return lines.length;
  }
  return Math.min(max, lines.length);
}

// ---------------------------------------------------------------------------
// Header line
// ---------------------------------------------------------------------------

/** Canonical verbs shown in tool-call headers, keyed by tool name. */
export const TOOL_VERBS: Record<string, string> = {
  read: "read",
  grep: "grep",
  find: "find",
  ls: "ls",
  bash: "$",
  edit: "edit",
  write: "write",
  mcp: "MCP",
};

/** Look up the header verb for a tool, falling back to the tool name itself. */
export function verbFor(toolName: string): string {
  return TOOL_VERBS[toolName] ?? toolName;
}

/**
 * Build a themed header line: a bold accent-coloured verb, an accent-coloured
 * primary token (e.g. a path), and an optional muted suffix.
 */
export function buildHeaderLine(
  verb: string,
  primary: string,
  suffixMuted: string,
  theme: RenderTheme,
): string {
  const verbPart = theme.fg("toolTitle", theme.bold(verb));
  const primaryPart = primary ? ` ${theme.fg("accent", primary)}` : "";
  const suffixPart = suffixMuted ? theme.fg("muted", suffixMuted) : "";
  return `${verbPart}${primaryPart}${suffixPart}`;
}

// ---------------------------------------------------------------------------
// Truncation hint
// ---------------------------------------------------------------------------

/** Shape of the details object various read-only tools attach for truncation. */
interface TruncatableDetails {
  truncation?: { truncated?: boolean };
  matchLimitReached?: number;
  resultLimitReached?: number;
  entryLimitReached?: number;
}

/**
 * Derive a short muted "truncated/limit reached" hint from a tool's details,
 * or an empty string when nothing was truncated.
 */
export function truncationHint(
  details: TruncatableDetails | undefined | null,
  theme: RenderTheme,
): string {
  if (!details) {
    return "";
  }
  let message: string | undefined;
  if (typeof details.matchLimitReached === "number") {
    message = `match limit reached (${details.matchLimitReached})`;
  } else if (typeof details.resultLimitReached === "number") {
    message = `result limit reached (${details.resultLimitReached})`;
  } else if (typeof details.entryLimitReached === "number") {
    message = `entry limit reached (${details.entryLimitReached})`;
  } else if (details.truncation?.truncated) {
    message = "output truncated";
  }
  if (!message) {
    return "";
  }
  return theme.fg("muted", message);
}

// ---------------------------------------------------------------------------
// Status icon / color
// ---------------------------------------------------------------------------

/** Status glyph for a tool result. */
export function statusIcon(isError: boolean): string {
  return isError ? "✗" : "✓";
}

/** Theme color name for a tool result status. */
export function statusColor(isError: boolean): "error" | "success" {
  return isError ? "error" : "success";
}

// ---------------------------------------------------------------------------
// Bash spinner helpers
// ---------------------------------------------------------------------------

/** Braille spinner frames used for the bash call indicator. */
export const BASH_SPINNER_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
] as const;

/** Spinner animation interval in milliseconds. */
export const BASH_SPINNER_INTERVAL_MS = 80;

/** Property key under which spinner state is stashed on the shared state object. */
const BASH_SPINNER_STATE_KEY = "__ampToolDisplayBashSpinner";

/** Mutable spinner state carried across renders for a single bash call. */
export interface BashSpinnerState {
  frameIndex: number;
  startedAt?: number;
  timer?: ReturnType<typeof setInterval>;
}

interface BashSpinnerStateCarrier {
  [BASH_SPINNER_STATE_KEY]?: BashSpinnerState;
}

function toStateCarrier(value: unknown): BashSpinnerStateCarrier | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  return value as BashSpinnerStateCarrier;
}

/**
 * Get (or lazily create) the spinner state stored on the tool's shared state
 * object. Returns undefined only when no usable carrier object is available.
 */
export function getOrCreateSpinnerState(value: unknown): BashSpinnerState | undefined {
  const carrier = toStateCarrier(value);
  if (!carrier) {
    return undefined;
  }
  const existing = carrier[BASH_SPINNER_STATE_KEY];
  if (existing) {
    return existing;
  }
  const created: BashSpinnerState = { frameIndex: 0 };
  carrier[BASH_SPINNER_STATE_KEY] = created;
  return created;
}

/** Stop and reset a spinner's timer (idempotent; safe on undefined). */
export function stopSpinner(state: BashSpinnerState | undefined): void {
  if (!state) {
    return;
  }
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = undefined;
  }
  state.frameIndex = 0;
  state.startedAt = undefined;
}

/** Format an elapsed duration (ms) as `Ns`, `Nm Ss`, or `Nh Mm`. */
export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (totalMinutes < 60) {
    return `${totalMinutes}m ${seconds}s`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}
