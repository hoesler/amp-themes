# Amp Tool Display — P2 (Self-authored tool rendering) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the bundled third-party `pi-tool-display` with our own Amp-styled, per-tool renderers, and remove the dependency (shedding its legacy `@mariozechner` coupling). **Single-tool rendering only — no multi-tool `Explored N` aggregation** (verified unsupported by Pi's extension API: only per-tool `renderCall`/`renderResult` and per-custom-type `registerMessageRenderer` exist; there is no turn/message-level hook to group consecutive tool calls).

**Architecture:** For each built-in tool we override (`read`, `grep`, `find`, `ls`, `bash`, `edit`, `write`), re-register the same name via `pi.registerTool({ name, execute, renderCall, renderResult })`, delegating `execute` to the public `createXTool(cwd)` factory so behavior is unchanged and only presentation is ours. Tools we do not override fall back to Pi's built-in default rendering (safety net). Collapse state comes from `context.expanded` / `options.expanded` (managed by Pi). Output is truncated with public `truncateHead`/`truncateTail`; edit/write diff bodies render via public `renderDiff(diffText)`. Rendering uses pi-tui `Text`/`Container` components.

**Tech Stack:** TypeScript ESM, `@earendil-works/pi-coding-agent` `^0.78.0` (public exports: `createReadTool`/`createGrepTool`/`createFindTool`/`createLsTool`/`createBashTool`/`createEditTool`/`createWriteTool`, `renderDiff`, `truncateHead`/`truncateTail`, `isReadToolResult`/`isEditToolResult`/…, `defineTool`), `@earendil-works/pi-tui` (`Text`, `Container`, `Spacer`, `truncateToWidth`, `visibleWidth`), Vitest.

**Reference:** the bundled `pi-tool-display` source (`node_modules/pi-tool-display/src/`) is MIT-licensed and a good technique reference — especially `tool-overrides.ts` (registration + per-tool titles), `bash-display.ts` (spinner+elapsed), `render-utils.ts` (preview/truncation), `diff-renderer.ts` (only as a fallback reference; we use Pi's `renderDiff`). Borrow ideas, not code wholesale.

**Out of scope:** multi-tool grouping; the config modal / settings inspector / zellij modal; the thinking-label context sanitization (we never inject `Thinking:` into message content). The native user-message box stays covered by the existing `amp-user-message.ts`.

---

## File Structure

- **Create** `extensions/amp-tool-display.ts` — entry: the default extension function that overrides each built-in tool. Owns the `overrideTool` registration helper and per-tool `renderCall`/`renderResult`.
- **Create** `extensions/amp-tool-render.ts` — pure, testable rendering helpers: verb/title map, header line builder, output-preview/truncation. No Pi event wiring; unit-tested.
- **Create** `extensions/amp-tool-render.test.ts` — unit tests for the pure helpers.
- **Modify** `package.json` — remove `pi-tool-display` from `dependencies`, `bundledDependencies`, and `pi.extensions`; add `./extensions/amp-tool-display.ts` to `pi.extensions`.
- **Modify** `extensions/amp-themes.test.ts` — the metadata test currently asserts bundled `pi-tool-display`; update it to assert the bundle is gone and our extension is registered.
- **Modify** `README.md` — replace "bundled `pi-tool-display`" wording with the self-authored renderer.

---

## Task 1: Override mechanism + bash, drop pi-tool-display (prove end-to-end)

**Files:**
- Create: `extensions/amp-tool-display.ts`
- Modify: `package.json`

- [ ] **Step 1: Confirm the public tool factories and result guards exist**

Run: `grep -rnE "createBashTool|createReadTool|createEditTool|isBashToolResult|truncateHead|truncateTail" node_modules/@earendil-works/pi-coding-agent/dist/index.d.ts`
Expected: all are exported. Note their import paths.

- [ ] **Step 2: Write the override helper + bash renderer**

Create `extensions/amp-tool-display.ts`:

```ts
import {
  createBashTool, createEditTool, createFindTool, createGrepTool,
  createLsTool, createReadTool, createWriteTool,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

type BuiltinFactory = (cwd: string) => {
  description: string;
  parameters: unknown;
  prepareArguments?: (args: unknown) => unknown;
  execute: (toolCallId: string, params: any, signal: any, onUpdate: any) => Promise<any>;
};

// Cache the delegate tools per cwd (they are cheap but construct fresh state).
const builtinCache = new Map<string, Map<string, ReturnType<BuiltinFactory>>>();
function builtin(cwd: string, name: string, factory: BuiltinFactory) {
  let byName = builtinCache.get(cwd);
  if (!byName) { byName = new Map(); builtinCache.set(cwd, byName); }
  let tool = byName.get(name);
  if (!tool) { tool = factory(cwd); byName.set(name, tool); }
  return tool;
}

export default function (pi: ExtensionAPI): void {
  // Bash first, to prove the override path end-to-end. Other tools land in later tasks.
  const bashFactory = createBashTool as unknown as BuiltinFactory;
  const sample = bashFactory(process.cwd());
  pi.registerTool({
    name: "bash",
    description: sample.description,
    parameters: sample.parameters as any,
    prepareArguments: sample.prepareArguments,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return builtin(ctx.cwd, "bash", bashFactory).execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args: { command?: string }, theme) {
      const cmd = typeof args.command === "string" && args.command.trim() ? args.command : "…";
      return new Text(`${theme.fg("toolTitle", theme.bold("$"))} ${theme.fg("accent", cmd)}`, 0, 0);
    },
  } as any);
}
```

> Executor: verify the exact `ToolDefinition` shape and `registerTool` signature against `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`. Replace the `as any` casts with the real generic types (`ToolDefinition<TParams, TDetails, TState>`); they are placeholders to keep the plan readable. Confirm `Text`'s constructor args (`new Text(content, x, y)` per pi-tui) — adjust if the signature differs.

- [ ] **Step 3: Swap the extension registration in package.json**

Replace the `pi-tool-display` entry in `pi.extensions` with our extension, and remove the dependency:

```json
    "extensions": [
      "./extensions/amp-appearance.ts",
      "./extensions/amp-editor.ts",
      "./extensions/amp-tool-display.ts",
      "./extensions/amp-user-message.ts"
    ],
```

Remove `"pi-tool-display": "^0.3.3"` from `dependencies`, remove `"pi-tool-display"` from `bundledDependencies`. Run `npm install` to update the lockfile.

- [ ] **Step 4: Verify load + baseline**

Run: `npm run typecheck && npm run check`
Expected: typecheck 0; `pi … -e . -p 'Reply with ok'` replies `ok` with our extension loaded and `pi-tool-display` absent. Run `npm test` — existing tests still pass (the `amp-themes` metadata test about bundled pi-tool-display will be updated in Task 6; if it fails now, leave it red and note it, or jump to Task 6 Step for that single test).

- [ ] **Step 5: Commit**

```bash
git add extensions/amp-tool-display.ts package.json package-lock.json
git commit -m "feat: self-authored tool display scaffold + bash, drop pi-tool-display dep"
```

---

## Task 2: Pure rendering helpers (verb map, header, preview) — TDD

**Files:**
- Create: `extensions/amp-tool-render.ts`
- Create: `extensions/amp-tool-render.test.ts`

- [ ] **Step 1: Write the failing test**

Create `extensions/amp-tool-render.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { toolVerb, headerLine, previewLines } from "./amp-tool-render.js";

const id = (_c: string, t: string) => t; // identity colorizer

describe("toolVerb", () => {
  test("maps known tools to Amp verbs", () => {
    expect(toolVerb("read")).toBe("Read");
    expect(toolVerb("grep")).toBe("Searched");
    expect(toolVerb("web_search")).toBe("Searched web:");
    expect(toolVerb("unknown_tool")).toBe("unknown_tool");
  });
});

describe("headerLine", () => {
  test("renders status icon + verb + target", () => {
    expect(headerLine({ icon: "✓", verb: "Read", target: "a.ts", fg: id, bold: (t) => t }))
      .toBe("✓ Read a.ts");
  });
});

describe("previewLines", () => {
  test("collapsed shows up to N lines with a remaining hint", () => {
    const out = previewLines(["1", "2", "3", "4"], { expanded: false, limit: 2 });
    expect(out.shown).toEqual(["1", "2"]);
    expect(out.remaining).toBe(2);
  });
  test("expanded shows everything", () => {
    const out = previewLines(["1", "2", "3"], { expanded: true, limit: 2 });
    expect(out.shown).toEqual(["1", "2", "3"]);
    expect(out.remaining).toBe(0);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npm test -- amp-tool-render`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `extensions/amp-tool-render.ts`:

```ts
const VERBS: Record<string, string> = {
  read: "Read",
  ls: "Listed",
  find: "Found",
  grep: "Searched",
  edit: "Edited",
  write: "Wrote",
  bash: "$",
  web_search: "Searched web:",
  web_fetch: "Fetched",
};

export function toolVerb(name: string): string {
  return VERBS[name] ?? name;
}

export function headerLine(input: {
  icon: string;
  verb: string;
  target: string;
  fg: (color: string, text: string) => string;
  bold: (text: string) => string;
}): string {
  const parts = [input.icon, input.bold(input.verb)];
  if (input.target) parts.push(input.target);
  return parts.join(" ");
}

export function previewLines(
  lines: string[],
  opts: { expanded: boolean; limit: number },
): { shown: string[]; remaining: number } {
  if (opts.expanded || lines.length <= opts.limit) {
    return { shown: lines, remaining: 0 };
  }
  return { shown: lines.slice(0, opts.limit), remaining: lines.length - opts.limit };
}
```

> Note: `headerLine`'s test passes identity `fg`/`bold`, so colors are not asserted — only structure. The real renderers pass theme functions. The verb map is the single source of truth; extend it as tools are covered.

- [ ] **Step 4: Run, verify it passes**

Run: `npm test -- amp-tool-render`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add extensions/amp-tool-render.ts extensions/amp-tool-render.test.ts
git commit -m "feat: pure tool-render helpers (verb map, header, preview)"
```

---

## Task 3: read / grep / find / ls renderers

**Files:**
- Modify: `extensions/amp-tool-display.ts`

- [ ] **Step 1: Add an override registration helper and the four read-only tools**

Generalize the Task 1 inline bash registration into a reusable `override(pi, name, factory, { renderCall, renderResult })`, then register `read`, `grep`, `find`, `ls` with:
- `renderCall`: header `<verb> <primary-arg>` (e.g. `Read a.ts`, `Searched /pattern/ in src`), spinner-less (these are fast). Use `toolVerb` + theme colors (path/arg in `accent`, secondary in `muted`).
- `renderResult`: header with `✓`/`✗` icon (from `options`/`context.isError`), then the output content collapsed via `previewLines(content, { expanded: options.expanded, limit: 8 })`, truncated per line to width with `truncateToWidth`. When `remaining > 0`, append a muted `… (${remaining} more lines · Ctrl+O)` hint. Read the result text from `AgentToolResult.content` (the `(TextContent|ImageContent)[]` — join the `text` of `TextContent` blocks).

Provide the concrete code for each tool's `renderCall`/`renderResult`, importing `Container`/`Text`/`truncateToWidth`/`visibleWidth` from `@earendil-works/pi-tui`. Use `context.expanded` for the call render and `options.expanded` for the result render. (Executor: confirm whether the result text lives on `result.content` text blocks or `result.details`; mirror how `pi-tool-display`'s read/grep `renderResult` extracts it — see `tool-overrides.ts` read/grep sections.)

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run check && npm test`
Expected: typecheck 0; loads `ok`; tests pass.

- [ ] **Step 3: Commit**

```bash
git add extensions/amp-tool-display.ts
git commit -m "feat: Amp-style read/grep/find/ls tool rendering"
```

---

## Task 4: bash renderer with spinner + elapsed + output

**Files:**
- Modify: `extensions/amp-tool-display.ts`

- [ ] **Step 1: Upgrade the bash renderCall and add renderResult**

Port `pi-tool-display`'s `bash-display.ts` technique into our bash renderer (it is ~150 lines and self-contained):
- `renderCall`: `<spinner?> $ <command>[ (timeout Ns)][ · <elapsed>]` — a braille spinner (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`, 80ms) and elapsed timer while `context.executionStarted && context.isPartial`; static `$ <command>` otherwise. Manage the spinner interval through `context.state` + `context.invalidate()` exactly as `bash-display.ts` does, and stop the timer when no longer partial.
- `renderResult`: `✓`/`✗` header (exit reflected via `context.isError`) + stdout/stderr collapsed via `previewLines(..., { expanded: options.expanded, limit: 10 })`.

Provide the full concrete code (adapted from `bash-display.ts`, with our `Text`/state handling). Cite `node_modules/pi-tool-display/src/bash-display.ts` as the reference.

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run check && npm test`
Expected: all green; bash shows a live spinner + elapsed when run interactively (manual check noted, not unit-tested).

- [ ] **Step 3: Commit**

```bash
git add extensions/amp-tool-display.ts
git commit -m "feat: Amp-style bash rendering with spinner and elapsed timer"
```

---

## Task 5: edit / write renderers with renderDiff

**Files:**
- Modify: `extensions/amp-tool-display.ts`

- [ ] **Step 1: Add edit/write renderers**

- `renderCall`: `Edited <path>` / `Wrote <path> (<n> lines)`.
- `renderResult`: header `✓ Edited <path>` then the diff body rendered with Pi's public `renderDiff(diffText)`. Source the diff text from the tool result — confirm where it lives (`EditToolDetails`/`WriteToolDetails` via `result.details`, or a unified-diff string in `result.content`); use the result guard `isEditToolResult`/`isWriteToolResult` to narrow. `renderDiff` returns a string; wrap it in a `Text` (or split into lines and emit a `Container`). Collapse long diffs with `previewLines` honoring `options.expanded`.

> Executor: `renderDiff(diffText: string, _options?)` returns a rendered string. Verify the exact field that carries the diff text by inspecting `EditToolDetails`/`WriteToolDetails` in `node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-agent-core/dist/types.d.ts` and how `pi-tool-display` sources it. If no ready diff string exists, compute one with `jsdiff` (already a transitive dep) from old/new content in details.

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run check && npm test`
Expected: all green; an `edit` shows a colored diff when run interactively.

- [ ] **Step 3: Commit**

```bash
git add extensions/amp-tool-display.ts
git commit -m "feat: Amp-style edit/write rendering via renderDiff"
```

---

## Task 6: web search / MCP fallback + metadata + docs

**Files:**
- Modify: `extensions/amp-tool-display.ts`, `extensions/amp-themes.test.ts`, `README.md`

- [ ] **Step 1: Generic renderer for web search and MCP tools**

If a web-search tool exists in `pi.getAllTools()`, wrap it with a `Searched web: <query>` header (collapsed result). Wrap MCP tools generically: `<server>:<tool> <summary>` header + collapsed output. Tools not matched keep Pi's default rendering (no override) — this is the intended fallback.

- [ ] **Step 2: Update the metadata regression test**

In `extensions/amp-themes.test.ts`, the test asserting bundled `pi-tool-display` must now assert it is **absent** and that `./extensions/amp-tool-display.ts` is in `pi.extensions`. Update the assertions to match (read the current assertions first; flip them).

- [ ] **Step 3: Update README**

Replace "bundled `pi-tool-display`" / "bundled compact tool rendering" wording with the self-authored Amp-style tool rendering. Remove the "If `npm:pi-tool-display` is installed separately, remove it" note (no longer bundled) or reword it.

- [ ] **Step 4: Verify**

Run: `npm run release:check`
Expected: typecheck + tests + check + pack:check all green; `npm pack --dry-run` no longer lists `pi-tool-display`.

- [ ] **Step 5: Commit**

```bash
git add extensions/amp-tool-display.ts extensions/amp-themes.test.ts README.md
git commit -m "feat: web/MCP tool rendering; drop pi-tool-display from metadata and docs"
```

---

## Task 7: Release 0.4.1

**Files:**
- Modify: `package.json`, `CHANGELOG.md`

- [ ] **Step 1: Full release gate** — `npm run release:check` (all green).
- [ ] **Step 2: Bump `version` to `0.4.1`; prepend a CHANGELOG `## 0.4.1` entry** describing: self-authored Amp-style per-tool rendering (read/grep/find/ls/bash/edit/write + web/MCP), `pi-tool-display` removed (no longer bundled; legacy `@mariozechner` coupling gone), uncovered tools fall back to Pi's default rendering, no multi-tool grouping (Pi API limitation).
- [ ] **Step 3: Commit** `chore: release 0.4.1`.
- [ ] **Step 4: Hand off** via `superpowers:finishing-a-development-branch` (merge to main, then npm publish with the user's passkey/automation token, tag, GitHub release).

---

## Self-Review

**Spec coverage (P2 section of the design spec):** override via same-name `registerTool` + execute delegation → Tasks 1,3,4,5. Collapse via `options.expanded` → Tasks 2–5. Truncation via `truncateHead/Tail` / `previewLines` → Tasks 2–5. Diff via `renderDiff` → Task 5. Verb map / Amp headers → Task 2. Drop `pi-tool-display` (deps + bundle + extensions + metadata + README) → Tasks 1,6. Inventory items that disappear (bash display, MCP) re-authored → Tasks 4,6; thinking-label sanitization intentionally dropped; user-message box already covered. Multi-tool grouping explicitly out of scope (Pi limitation). ✅

**Placeholder scan:** the `as any` casts in Task 1 and the "confirm where the diff lives" notes are explicit executor-verification instructions against real types, not unfinished work; the pure helpers (Task 2) are fully concrete and TDD'd.

**Type consistency:** `toolVerb`, `headerLine`, `previewLines`, `override`, `builtin` used consistently across tasks. `renderCall`/`renderResult`/`ToolRenderContext`/`options.expanded` match the verified 0.78 API.

**Risk:** the exact result-text/diff-text source fields are the main unknowns; each task instructs the executor to confirm against the agent-core types and mirror `pi-tool-display`. The Pi-default fallback for uncovered/edge tools bounds the blast radius.
