# P2 Implementation Brief — Self-Authored Amp-Style Tool Rendering

Ground truth, verified against `node_modules/@earendil-works/pi-coding-agent@0.78` + `@earendil-works/pi-tui@0.78` in this repo, and **empirically proven** (the override compiles via `tsc --noEmit` and loads via `npm run check` with `pi-tool-display` fully removed — zero `MODULE_NOT_FOUND`/error lines). Single-tool scope (no multi-tool grouping). This brief SUPERSEDES the plan wherever they differ.

## 0. Corrections (the plan/probes were wrong on these)

- **C1 — tools use `args.path`**, NOT `file_path`. `read = {path, offset?, limit?}`, grep/find/ls also use `path` (read.d.ts:1-9, grep/find/ls.d.ts).
- **C2 — bash output is in `result.content`** (extract via `extractTextOutput`), NOT in details. `BashToolDetails = { truncation?, fullOutputPath? }` (bash.d.ts:10-13) — no exitCode/stdout/stderr. Surface `details.fullOutputPath` as a "full output at …" hint. `context.isError` is reliable only in `renderResult`.
- **C3 — use `create<Tool>ToolDefinition(cwd)`** (returns a real `ToolDefinition` with 5-arg execute), NOT `create<Tool>Tool`. Spread the definition and override only the renderers → **zero casts, zero `any`**, execution inherited unchanged.
- `renderDiff(diffText: string, _options?): string` is a top-level export (index.d.ts:24). It returns an ANSI string and **ignores the options arg** — the **caller** does collapse via `.split("\n").slice(0, N)`.
- `label` is **required** on `ToolDefinition`. `Theme`, `truncateHead/truncateTail/truncateLine`, `create*ToolDefinition` are all top-level re-exports.
- `edit` built-in sets `renderShell: "self"` (inherited when you spread its definition) — keep it (matches a diff-centric look); verify visually once.
- **No built-in web-search/web-fetch** in Pi. The web section is **MCP-only**.
- **No jsdiff** in node_modules and no diff generator → `write` gets **content preview only** (no diff). Decided.

## 1. Override mechanism (verified)

`ToolDefinition<TParams,TDetails,TState>` (types.d.ts:328-359): required `name`, `label`, `description`, `parameters`; optional `renderShell?: "default"|"self"`, `prepareArguments?`, `executionMode?`; `execute(toolCallId, params, signal, onUpdate, ctx)`; render hooks `renderCall?(args, theme, context)` and `renderResult?(result, options, theme, context)`. Last `registerTool({name})` wins (registry is a `Map<name, ToolDefinition>`); register synchronously in the extension factory.

```ts
import {
  createBashToolDefinition, createReadToolDefinition, createGrepToolDefinition,
  createFindToolDefinition, createLsToolDefinition, createEditToolDefinition,
  createWriteToolDefinition,
  type ExtensionAPI, type ToolDefinition, type ToolRenderContext,
  type ToolRenderResultOptions, type AgentToolResult, type Theme,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";
import type { Static, TSchema } from "@sinclair/typebox"; // confirm the actual typebox import path the package uses

function override<TParams extends TSchema, TDetails, TState>(
  pi: ExtensionAPI,
  def: ToolDefinition<TParams, TDetails, TState>,          // from create<Tool>ToolDefinition(cwd)
  renderers: {
    renderCall?: (a: Static<TParams>, t: Theme, c: ToolRenderContext<TState, Static<TParams>>) => Component;
    renderResult?: (r: AgentToolResult<TDetails>, o: ToolRenderResultOptions, t: Theme, c: ToolRenderContext<TState, Static<TParams>>) => Component;
  },
): void {
  pi.registerTool({ ...def, renderCall: renderers.renderCall ?? def.renderCall, renderResult: renderers.renderResult ?? def.renderResult });
}
```

> The exact `Static`/`TSchema` import path: confirm what `types.d.ts` imports typebox from (it may be re-exported by pi-coding-agent or come from a specific path). If generics fight you, the spread still works with the `ToolDefinition` already carrying its own generics — prefer letting inference flow from `def`.

**Components:** `new Text(text?: string, paddingX = 0, paddingY = 0)` (text.d.ts:13), has `.setText()` / `.invalidate()`. `Container` (`children: Component[]`, `addChild`, `render(width)`) only if stacking multiple sub-components; a single `Text` suffices for every recipe. Renderers RETURN these Component objects.

**Fallback:** tools we don't override use Pi's **default** renderer (no pi-tool-display fallback once removed). Provide BOTH renderCall and renderResult for a fully custom look.

## 2. Per-tool recipes

**All output text comes from `result.content`** (filter `block.type === "text"`, join `.text`) via the shared `extractTextOutput`. `AgentToolResult<T> = { content, details: T, terminate? }`.

- **read** (`createReadToolDefinition`): header `read <path>[:<from>-<to>]` from `args.path`/`offset`/`limit` (path accent, range warning-colored). result: `extractTextOutput` → preview (collapsed `config.previewLines`, expanded `getExpandedPreviewLineLimit`); hint from `details.truncation.truncated`.
- **grep** (`createGrepToolDefinition`): header `grep /<pattern>/ in <path>[ (glob)][ limit N]`. `details.matchLimitReached` → hint.
- **find** (`createFindToolDefinition`): header `find <pattern> in <scope>[ (limit N)]`. `details.resultLimitReached` → hint.
- **ls** (`createLsToolDefinition`): header `ls <scope>[ (limit N)]`. `details.entryLimitReached` → hint.
- **bash** (`createBashToolDefinition`): renderCall = braille spinner (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`, 80ms) + `$ <command>[ (timeout Ns)][ · <elapsed>]` while `context.executionStarted && context.isPartial`; manage timer in `context.state` + `context.invalidate()`; `stopSpinner` when no longer partial. renderResult = status icon (✓/✗ from `context.isError`) + `extractTextOutput` preview (limit ~10) + optional `full output at <details.fullOutputPath>`.
- **edit** (`createEditToolDefinition`): renderCall `edit <path>`. renderResult: `const colored = details?.diff ? renderDiff(details.diff) : extractTextOutput(result)`; collapse caller-side: `colored.split("\n").slice(0, options.expanded ? expandedLimit : config.previewLines)`; append `… (N more)` hint. Keep inherited `renderShell:"self"`.
- **write** (`createWriteToolDefinition`): NO diff (details is `undefined`). renderCall `write <path>`. renderResult: header `wrote <path> (<N> lines)` + content preview from `args.content`/`extractTextOutput`.
- **MCP** (no built-in web search): discover via `pi.getAllTools()` (wrap in try/catch) on `session_start` AND `before_agent_start`, dedupe by name `Set`. `ToolInfo` lacks `label`/`promptSnippet` → rebuild a label (`MCP <name>`). Candidate check: `name === "mcp"` or `/\bmcp\b/i.test(description)`. Header `MCP <target>` + generic preview.

## 3. Shared helpers (pure, in `amp-tool-render.ts`, unit-tested)

`extractTextOutput(result): string` · `shortenPath(p): string` (home/cwd-relative) · `previewLines(lines, maxLines): {shown, remaining}` · `getExpandedPreviewLineLimit(lines, config): number` (`config.expandedPreviewMaxLines`, 0 ⇒ all) · `buildHeaderLine(verb, primary, suffixMuted, theme)` + verb map · `truncationHint(details, theme): string` · `statusIcon/statusColor(isError)` · bash spinner helpers (`getOrCreateSpinnerState`, `stopSpinner`, `formatElapsed`, `BASH_SPINNER_FRAMES`, `BASH_SPINNER_INTERVAL_MS=80`). Plus a `getConfig()` closure with defaults (`previewLines` ~8, `expandedPreviewMaxLines` ~4000) — no config modal needed.

## 4. Risks / decisions

- **R1 write:** no diff source → content preview only (decided; don't port LCS).
- **R2 renderDiff** ignores options → caller collapses.
- **R3 edit `renderShell:"self"`** inherited → keep, verify visually.
- **R4 `context.state`** must be a mutable carrier; always `stopSpinner` on `isPartial→false` (timer leak). Fallback: module-level `Map<toolCallId, state>`.
- **R5** no `getRegisteredTool` / no renderer chaining → re-author, don't wrap.
- **R6 `getAllTools()` can throw** → try/catch; register MCP on both events, deduped.

## 5. File structure (per-tool modules for clarity + parallel build)

- `extensions/amp-tool-config.ts` — `getConfig()` + defaults.
- `extensions/amp-tool-render.ts` — pure shared helpers (+ `amp-tool-render.test.ts`).
- `extensions/amp-tools-readonly.ts` — read/grep/find/ls renderCall+renderResult (+ test).
- `extensions/amp-tools-bash.ts` — bash renderCall+renderResult (+ test).
- `extensions/amp-tools-edit.ts` — edit + write renderCall+renderResult (+ test).
- `extensions/amp-tools-mcp.ts` — MCP discovery + render.
- `extensions/amp-tool-display.ts` — extension entry: `override()` helper, build each `create<Tool>ToolDefinition(cwd)`, wire renderers from the tool modules, MCP `getAllTools` loop on session_start + before_agent_start.

Removal: drop `pi-tool-display` from `dependencies`, `bundledDependencies`, and `pi.extensions`; add `./extensions/amp-tool-display.ts`. `@earendil-works/pi-tui` stays (peer+dev). Update `amp-themes.test.ts` (bundled-pi-tool-display assertion → absent + our extension present) and README. Re-run `npm run check` after wiring (load proven on the createBashTool path; types proven on the spread path).
