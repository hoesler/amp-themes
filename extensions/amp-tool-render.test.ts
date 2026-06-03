import { homedir } from "node:os";
import { describe, expect, test } from "vitest";
import {
  BASH_SPINNER_FRAMES,
  BASH_SPINNER_INTERVAL_MS,
  buildHeaderLine,
  collapseForPreview,
  extractTextOutput,
  formatElapsed,
  getExpandedPreviewLineLimit,
  getOrCreateSpinnerState,
  moreHint,
  previewLines,
  shortenPath,
  splitLines,
  statusColor,
  statusIcon,
  stopSpinner,
  TOOL_VERBS,
  truncationHint,
  verbFor,
  type RenderTheme,
} from "./amp-tool-render.js";

/** A theme stub that tags output so assertions can see which color was applied. */
const theme: RenderTheme = {
  fg: (color, text) => `<${color}>${text}</${color}>`,
  bold: (text) => `*${text}*`,
};

describe("extractTextOutput", () => {
  test("joins text content blocks with newlines", () => {
    const result = {
      content: [
        { type: "text", text: "line one" },
        { type: "text", text: "line two" },
      ],
    };
    expect(extractTextOutput(result)).toBe("line one\nline two");
  });

  test("ignores non-text blocks and malformed entries", () => {
    const result = {
      content: [
        { type: "image", data: "..." },
        { type: "text", text: "kept" },
        { type: "text" },
        null,
        "raw string",
      ],
    };
    expect(extractTextOutput(result)).toBe("kept");
  });

  test("returns empty string when content is missing or not an array", () => {
    expect(extractTextOutput({})).toBe("");
    expect(extractTextOutput({ content: "nope" })).toBe("");
  });
});

describe("shortenPath", () => {
  test("collapses the home directory to ~", () => {
    const home = homedir();
    expect(shortenPath(`${home}/projects/app.ts`)).toBe("~/projects/app.ts");
  });

  test("leaves non-home paths untouched", () => {
    expect(shortenPath("/etc/hosts")).toBe("/etc/hosts");
  });

  test("returns empty string for undefined", () => {
    expect(shortenPath(undefined)).toBe("");
  });
});

describe("splitLines", () => {
  test("normalises CRLF and expands tabs", () => {
    expect(splitLines("a\r\n\tb")).toEqual(["a", "    b"]);
  });

  test("returns empty array for empty string", () => {
    expect(splitLines("")).toEqual([]);
  });
});

describe("previewLines", () => {
  test("reports shown lines and remaining count", () => {
    const lines = ["1", "2", "3", "4", "5"];
    const { shown, remaining } = previewLines(lines, 3);
    expect(shown).toEqual(["1", "2", "3"]);
    expect(remaining).toBe(2);
  });

  test("remaining is zero when all lines fit", () => {
    const { shown, remaining } = previewLines(["a", "b"], 8);
    expect(shown).toEqual(["a", "b"]);
    expect(remaining).toBe(0);
  });

  test("clamps a negative limit to zero", () => {
    const { shown, remaining } = previewLines(["a", "b"], -5);
    expect(shown).toEqual([]);
    expect(remaining).toBe(2);
  });
});

describe("getExpandedPreviewLineLimit", () => {
  const lines = Array.from({ length: 100 }, (_, i) => String(i));

  test("caps at the configured max", () => {
    expect(getExpandedPreviewLineLimit(lines, { expandedPreviewMaxLines: 40 })).toBe(40);
  });

  test("never exceeds the number of available lines", () => {
    expect(getExpandedPreviewLineLimit(lines, { expandedPreviewMaxLines: 4000 })).toBe(100);
  });

  test("zero means show all lines", () => {
    expect(getExpandedPreviewLineLimit(lines, { expandedPreviewMaxLines: 0 })).toBe(100);
  });
});

describe("collapseForPreview", () => {
  const lines = Array.from({ length: 20 }, (_, i) => String(i));
  const config = { previewLines: 8, expandedPreviewMaxLines: 4000 };

  test("collapsed uses config.previewLines", () => {
    const { shown, remaining } = collapseForPreview(lines, false, config);
    expect(shown).toHaveLength(8);
    expect(remaining).toBe(12);
  });

  test("expanded uses the expanded limit", () => {
    const { shown, remaining } = collapseForPreview(lines, true, {
      previewLines: 8,
      expandedPreviewMaxLines: 5,
    });
    expect(shown).toHaveLength(5);
    expect(remaining).toBe(15);
  });

  test("expanded with max 0 shows all lines", () => {
    const { shown, remaining } = collapseForPreview(lines, true, {
      previewLines: 8,
      expandedPreviewMaxLines: 0,
    });
    expect(shown).toHaveLength(20);
    expect(remaining).toBe(0);
  });

  test("an overridden previewLines budget is honoured when collapsed", () => {
    const { shown, remaining } = collapseForPreview(lines, false, {
      previewLines: 10,
      expandedPreviewMaxLines: 4000,
    });
    expect(shown).toHaveLength(10);
    expect(remaining).toBe(10);
  });
});

describe("moreHint", () => {
  test("returns a muted hint when lines were hidden", () => {
    expect(moreHint(3, theme)).toBe("<muted>… (3 more lines)</muted>");
  });

  test("singular for a single hidden line", () => {
    expect(moreHint(1, theme)).toBe("<muted>… (1 more line)</muted>");
  });

  test("returns empty string when nothing was hidden", () => {
    expect(moreHint(0, theme)).toBe("");
    expect(moreHint(-2, theme)).toBe("");
  });
});

describe("verb map", () => {
  test("known tools map to their canonical verbs", () => {
    expect(TOOL_VERBS.read).toBe("read");
    expect(TOOL_VERBS.bash).toBe("$");
    expect(TOOL_VERBS.mcp).toBe("MCP");
    expect(verbFor("grep")).toBe("grep");
  });

  test("unknown tool falls back to its own name", () => {
    expect(verbFor("custom_tool")).toBe("custom_tool");
  });
});

describe("buildHeaderLine", () => {
  test("colors verb, primary, and muted suffix", () => {
    const line = buildHeaderLine("read", "src/app.ts", " :1-40", theme);
    expect(line).toBe("<toolTitle>*read*</toolTitle> <accent>src/app.ts</accent><muted> :1-40</muted>");
  });

  test("omits primary and suffix when empty", () => {
    expect(buildHeaderLine("ls", "", "", theme)).toBe("<toolTitle>*ls*</toolTitle>");
  });
});

describe("truncationHint", () => {
  test("reports grep match limit", () => {
    expect(truncationHint({ matchLimitReached: 50 }, theme)).toBe("<muted>match limit reached (50)</muted>");
  });

  test("reports find result limit", () => {
    expect(truncationHint({ resultLimitReached: 100 }, theme)).toBe("<muted>result limit reached (100)</muted>");
  });

  test("reports ls entry limit", () => {
    expect(truncationHint({ entryLimitReached: 200 }, theme)).toBe("<muted>entry limit reached (200)</muted>");
  });

  test("reports generic output truncation", () => {
    expect(truncationHint({ truncation: { truncated: true } }, theme)).toBe("<muted>output truncated</muted>");
  });

  test("returns empty string when nothing was truncated", () => {
    expect(truncationHint(undefined, theme)).toBe("");
    expect(truncationHint({ truncation: { truncated: false } }, theme)).toBe("");
  });
});

describe("status helpers", () => {
  test("icon reflects error state", () => {
    expect(statusIcon(false)).toBe("✓");
    expect(statusIcon(true)).toBe("✗");
  });

  test("color reflects error state", () => {
    expect(statusColor(false)).toBe("success");
    expect(statusColor(true)).toBe("error");
  });
});

describe("formatElapsed", () => {
  test("seconds under a minute", () => {
    expect(formatElapsed(5_000)).toBe("5s");
    expect(formatElapsed(0)).toBe("0s");
  });

  test("minutes and seconds", () => {
    expect(formatElapsed(75_000)).toBe("1m 15s");
  });

  test("hours and minutes", () => {
    expect(formatElapsed(3_700_000)).toBe("1h 1m");
  });

  test("clamps negatives to 0s", () => {
    expect(formatElapsed(-100)).toBe("0s");
  });
});

describe("bash spinner constants", () => {
  test("ten braille frames at 80ms", () => {
    expect(BASH_SPINNER_FRAMES).toHaveLength(10);
    expect(BASH_SPINNER_FRAMES[0]).toBe("⠋");
    expect(BASH_SPINNER_INTERVAL_MS).toBe(80);
  });
});

describe("spinner state lifecycle", () => {
  test("creates state on a carrier object and reuses it", () => {
    const carrier: Record<string, unknown> = {};
    const first = getOrCreateSpinnerState(carrier);
    const second = getOrCreateSpinnerState(carrier);
    expect(first).toBeDefined();
    expect(first).toBe(second);
    expect(first?.frameIndex).toBe(0);
  });

  test("returns undefined for non-object carriers", () => {
    expect(getOrCreateSpinnerState(undefined)).toBeUndefined();
    expect(getOrCreateSpinnerState(42)).toBeUndefined();
  });

  test("stopSpinner clears the timer and resets fields", () => {
    const carrier: Record<string, unknown> = {};
    const state = getOrCreateSpinnerState(carrier);
    expect(state).toBeDefined();
    if (!state) return;
    state.startedAt = Date.now();
    state.frameIndex = 3;
    state.timer = setInterval(() => {}, 1000);
    stopSpinner(state);
    expect(state.timer).toBeUndefined();
    expect(state.frameIndex).toBe(0);
    expect(state.startedAt).toBeUndefined();
  });

  test("stopSpinner is safe on undefined", () => {
    expect(() => stopSpinner(undefined)).not.toThrow();
  });
});
