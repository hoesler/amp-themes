/**
 * Configuration for amp-style tool rendering.
 *
 * Kept intentionally tiny and dependency-free: a single typed `getConfig()`
 * closure returning sensible defaults. No interactive config modal — the
 * defaults match Amp's compact look and can be tightened later if needed.
 */

/** Per-tool enable flags. When false, the tool falls back to Pi's default renderer. */
export interface ToolEnableFlags {
  read: boolean;
  grep: boolean;
  find: boolean;
  ls: boolean;
  bash: boolean;
  edit: boolean;
  write: boolean;
  mcp: boolean;
}

/** Resolved configuration for the amp tool display extension. */
export interface AmpToolConfig {
  /** Number of output lines shown in the collapsed preview. */
  previewLines: number;
  /** Maximum lines shown when the result view is expanded. 0 means "show all". */
  expandedPreviewMaxLines: number;
  /** Per-tool enable flags. */
  tools: ToolEnableFlags;
}

const DEFAULT_CONFIG: AmpToolConfig = {
  previewLines: 8,
  expandedPreviewMaxLines: 4000,
  tools: {
    read: true,
    grep: true,
    find: true,
    ls: true,
    bash: true,
    edit: true,
    write: true,
    mcp: true,
  },
};

/**
 * Return the resolved tool-display configuration.
 *
 * Currently always returns the defaults. Exposed as a function so callers
 * (renderers) never close over a mutable singleton and so a future config
 * source can be threaded in without changing call sites.
 */
export function getConfig(): AmpToolConfig {
  return {
    ...DEFAULT_CONFIG,
    tools: { ...DEFAULT_CONFIG.tools },
  };
}
