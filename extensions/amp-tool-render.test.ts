import { homedir } from "node:os";
import { describe, expect, test } from "vitest";
import {
  BASH_SPINNER_FRAMES,
  BASH_SPINNER_INTERVAL_MS,
  bashTruncationHint,
  buildHeaderLine,
  collapseForPreview,
  extractTextOutput,
  formatElapsed,
  formatReadRange,
  formatSize,
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

  test("appends a total segment when given", () => {
    expect(moreHint(4, theme, { total: 12 })).toBe("<muted>… (4 more lines, 12 total)</muted>");
  });

  test("appends a pre-rendered expand hint outside the muted wrap", () => {
    expect(moreHint(3, theme, { expandHint: "<dim>ctrl+o</dim> to expand" })).toBe(
      "<muted>… (3 more lines,</muted> <dim>ctrl+o</dim> to expand<muted>)</muted>",
    );
  });

  test("combines total and expand hint", () => {
    expect(moreHint(4, theme, { total: 12, expandHint: "X" })).toBe(
      "<muted>… (4 more lines, 12 total,</muted> X<muted>)</muted>",
    );
  });

  test("no hint emitted when nothing hidden, even with opts", () => {
    expect(moreHint(0, theme, { total: 9, expandHint: "X" })).toBe("");
  });
});

describe("formatReadRange", () => {
  test("whole-file read (no bounds) shows no range", () => {
    expect(formatReadRange(undefined, undefined)).toBe("");
  });

  test("offset is 1-indexed and the end line is inclusive", () => {
    // Pi reads 15 lines from line 1 -> lines 1..15, not 1..16.
    expect(formatReadRange(1, 15)).toBe(":1-15");
    expect(formatReadRange(11, 15)).toBe(":11-25");
  });

  test("offset defaults to 1 when only a limit is given", () => {
    expect(formatReadRange(undefined, 20)).toBe(":1-20");
  });

  test("open-ended read (offset, no limit) shows a bare line with no trailing dash", () => {
    expect(formatReadRange(40, undefined)).toBe(":40");
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

describe("formatSize", () => {
  test("bytes, KB, and MB thresholds match Pi", () => {
    expect(formatSize(512)).toBe("512B");
    expect(formatSize(50 * 1024)).toBe("50.0KB");
    expect(formatSize(1024 * 1024)).toBe("1.0MB");
  });
});

describe("truncationHint (Pi-aligned wording)", () => {
  test("grep: matches limit, byte limit, and partial-line note join", () => {
    expect(
      truncationHint(
        "grep",
        { matchLimitReached: 50, truncation: { truncated: true, maxBytes: 50 * 1024 }, linesTruncated: true },
        theme,
      ),
    ).toBe("<warning>[Truncated: 50 matches limit, 50.0KB limit, some lines truncated]</warning>");
  });

  test("find: results limit only", () => {
    expect(truncationHint("find", { resultLimitReached: 100 }, theme)).toBe(
      "<warning>[Truncated: 100 results limit]</warning>",
    );
  });

  test("ls: entries limit only", () => {
    expect(truncationHint("ls", { entryLimitReached: 200 }, theme)).toBe(
      "<warning>[Truncated: 200 entries limit]</warning>",
    );
  });

  test("read: line-limit truncation reports shown/total and the line cap", () => {
    expect(
      truncationHint(
        "read",
        { truncation: { truncated: true, truncatedBy: "lines", outputLines: 2000, totalLines: 5000, maxLines: 2000 } },
        theme,
      ),
    ).toBe("<warning>[Truncated: showing 2000 of 5000 lines (2000 line limit)]</warning>");
  });

  test("read: byte-limit truncation reports lines shown and the size cap", () => {
    expect(
      truncationHint(
        "read",
        { truncation: { truncated: true, truncatedBy: "bytes", outputLines: 30, maxBytes: 50 * 1024 } },
        theme,
      ),
    ).toBe("<warning>[Truncated: 30 lines shown (50.0KB limit)]</warning>");
  });

  test("read: a first line over the byte limit is called out", () => {
    expect(
      truncationHint("read", { truncation: { truncated: true, firstLineExceedsLimit: true, maxBytes: 50 * 1024 } }, theme),
    ).toBe("<warning>[First line exceeds 50.0KB limit]</warning>");
  });

  test("returns empty string when nothing was truncated", () => {
    expect(truncationHint("read", undefined, theme)).toBe("");
    expect(truncationHint("ls", { truncation: { truncated: false } }, theme)).toBe("");
    expect(truncationHint("find", {}, theme)).toBe("");
  });
});

describe("bashTruncationHint", () => {
  test("joins the spill-file note and the truncation note with '. '", () => {
    expect(
      bashTruncationHint(
        { fullOutputPath: "/tmp/out.txt", truncation: { truncated: true, truncatedBy: "lines", outputLines: 10, totalLines: 99 } },
        theme,
      ),
    ).toBe("<warning>[Full output: /tmp/out.txt. Truncated: showing 10 of 99 lines]</warning>");
  });

  test("spill-file path is shortened to ~", () => {
    const out = bashTruncationHint({ fullOutputPath: `${homedir()}/x/out.txt` }, theme);
    expect(out).toBe("<warning>[Full output: ~/x/out.txt]</warning>");
  });

  test("byte-limit truncation reports the size cap", () => {
    expect(
      bashTruncationHint({ truncation: { truncated: true, truncatedBy: "bytes", outputLines: 5, maxBytes: 50 * 1024 } }, theme),
    ).toBe("<warning>[Truncated: 5 lines shown (50.0KB limit)]</warning>");
  });

  test("returns empty string when neither truncated nor spilled", () => {
    expect(bashTruncationHint(undefined, theme)).toBe("");
    expect(bashTruncationHint({ truncation: { truncated: false } }, theme)).toBe("");
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
