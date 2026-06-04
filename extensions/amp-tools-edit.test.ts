/**
 * Unit tests for the `edit` and `write` result rendering logic.
 *
 * We test the pure `build*ResultText` helpers directly (the renderers are thin
 * `new Text(build…)` wrappers), driving them with a tagging theme stub
 * (`<color>…</color>` instead of ANSI). This keeps the assertions independent
 * of the `Text` component's word-wrapping/padding AND of `renderDiff`'s ANSI
 * output: the diff branch is covered by passing a pre-colored string with
 * `hasDiff: true`, exercising the exact collapse code path `renderEditResult`
 * feeds `renderDiff(...)` into.
 */
import { describe, expect, test } from "vitest";
import type { ToolRenderResultOptions } from "@earendil-works/pi-coding-agent";
import { buildEditResultText, buildWriteResultText } from "./amp-tools-edit.js";
import type { RenderTheme } from "./amp-tool-render.js";

/** Theme stub that tags output so assertions can see which color was applied. */
const theme: RenderTheme = {
  fg: (color, text) => `<${color}>${text}</${color}>`,
  bold: (text) => `*${text}*`,
};

const collapsed: ToolRenderResultOptions = { expanded: false } as ToolRenderResultOptions;
const expanded: ToolRenderResultOptions = { expanded: true } as ToolRenderResultOptions;

function nLines(n: number, prefix = "line"): string {
  return Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`).join("\n");
}

describe("buildEditResultText (plain output / no diff)", () => {
  test("collapses output to the configured 8-line preview limit", () => {
    const out = buildEditResultText(nLines(12), false, collapsed, theme);
    expect(out).toContain("line 1");
    expect(out).toContain("line 8");
    expect(out).not.toContain("line 9");
    expect(out).toContain("(4 more lines)");
  });

  test("wraps the plain-output branch in the tool-output color", () => {
    const out = buildEditResultText("just text", false, collapsed, theme);
    expect(out).toContain("<toolOutput>just text</toolOutput>");
  });

  test("expands to show every line with no 'more' hint", () => {
    const out = buildEditResultText(nLines(12), false, expanded, theme);
    expect(out).toContain("line 12");
    expect(out).not.toContain("more line");
  });

  test("singular 'more line' when exactly one line is hidden", () => {
    const out = buildEditResultText(nLines(9), false, collapsed, theme);
    expect(out).toContain("(1 more line)");
    expect(out).not.toContain("more lines");
  });

  test("reports no changes for empty content", () => {
    expect(buildEditResultText("", false, collapsed, theme)).toContain("edit: no changes");
  });
});

describe("buildEditResultText (diff branch)", () => {
  test("emits the pre-colored diff verbatim, never re-coloring it", () => {
    const diff = "+added\n-removed\n unchanged";
    const out = buildEditResultText(diff, true, collapsed, theme);
    expect(out).toContain("+added");
    expect(out).toContain("-removed");
    // The diff carries its own colors -> not wrapped in <toolOutput>.
    expect(out).not.toContain("<toolOutput>");
  });

  test("collapses a long diff and counts the hidden diff lines", () => {
    const out = buildEditResultText(nLines(20, "@@"), true, collapsed, theme);
    expect(out).toContain("@@ 8");
    expect(out).not.toContain("@@ 9");
    expect(out).toContain("(12 more lines)");
  });
});

describe("buildWriteResultText", () => {
  test("header reports path and line count", () => {
    const out = buildWriteResultText("/tmp/file.txt", "a\nb\nc", collapsed, theme);
    expect(out).toContain("wrote");
    expect(out).toContain("/tmp/file.txt");
    expect(out).toContain("(3 lines)");
  });

  test("a single trailing newline does not add a phantom line", () => {
    const out = buildWriteResultText("/tmp/file.txt", "a\nb\n", collapsed, theme);
    expect(out).toContain("(2 lines)");
  });

  test("singular '(1 line)' for single-line content", () => {
    const out = buildWriteResultText("/tmp/x", "only", collapsed, theme);
    expect(out).toContain("(1 line)");
    expect(out).not.toContain("(1 lines)");
  });

  test("empty content reports 0 lines and no preview body", () => {
    const out = buildWriteResultText("/tmp/x", "", collapsed, theme);
    expect(out).toContain("(0 lines)");
    expect(out).not.toContain("<toolOutput>");
  });

  test("collapses the content preview and reports hidden lines", () => {
    const out = buildWriteResultText("/tmp/big", nLines(12, "row"), collapsed, theme);
    expect(out).toContain("(12 lines)");
    expect(out).toContain("row 1");
    expect(out).toContain("row 8");
    expect(out).not.toContain("row 9");
    // write mirrors Pi's hint, which also reports the file's total line count.
    expect(out).toContain("(4 more lines, 12 total)");
  });
});
