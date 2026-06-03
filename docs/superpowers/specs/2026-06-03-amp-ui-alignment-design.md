# amp-themes — Amp UI Alignment + Pi 0.78 Upgrade

**Date:** 2026-06-03
**Status:** Approved design, pending implementation plan
**Branch:** `worktree-amp-ui-align`

## Goal

Align `amp-themes` (an Amp-inspired UI suite for the [Pi](https://pi.dev) coding agent)
with the real Amp app's terminal UI, add automatic dark/light theme switching that
follows the device, and upgrade the Pi dependency from 0.74 to 0.78. Reference
screenshots of the real Amp app provided by the user drive the visual target.

Work is split into two independently shippable phases:

- **P1 — Visual alignment** (theme auto-sync, status bar, thinking label, working
  status, library upgrade). Ships first.
- **P2 — Self-authored tool display** (replace bundled `pi-tool-display`). Ships
  second.

## Verified Pi capabilities (all public API, Pi ≥ 0.75)

Confirmed against the installed `@earendil-works/pi-coding-agent` / `pi-tui` type
definitions:

- `ctx.ui.setTheme(name | Theme) → {success, error?}`, `ctx.ui.getTheme(name)`,
  `ctx.ui.getAllThemes()` — runtime theme switching.
- `ctx.ui.setWorkingIndicator({ frames?: string[], intervalMs?: number })` — official
  working indicator; `frames: []` hides it; custom frames render verbatim.
  (Replaces today's `setWorkingVisible?.(false)` cast hack.)
- `createReadTool/createGrepTool/createFindTool/createLsTool/createBashTool/createEditTool/createWriteTool(cwd)`,
  `wrapRegisteredTool`, `defineTool` — public tool factories for delegating `execute`.
- `renderDiff(...)` + `RenderDiffOptions`, `truncateHead/truncateTail/truncateLine`,
  `TruncationOptions` — public render/truncation utilities.
- Per-tool `renderCall` / `renderResult` hooks with `ToolRenderContext` exposing
  `expanded` (collapse state is managed by Pi, not us).
- `thinking_level_select` event (already used) for thinking-level changes.

Signatures to re-confirm at implementation time, after bumping the dep past 0.74:
`setWorkingIndicator`, `renderDiff` exact argument shapes.

## Non-goals (this round)

- **Outline (`≡`) panel.** Amp's `≡` is a hover-triggered table-of-contents of
  conversation headings. Pi is a pure TUI with no border-glyph hover and no
  scroll-to API, so the interaction does not translate. Deferred.
- Aligning `amp-light` / other palettes beyond what auto-sync needs.

---

## P1 — Visual alignment

### 1. Appearance detection & auto-sync — `extensions/amp-appearance.ts` (new)

Detect whether the device is in dark or light mode and switch the active theme to
match, re-checking as the OS appearance flips.

**Detection chain (first that succeeds wins):**

1. **macOS system setting (primary):** `execFileSync("defaults", ["read", "-g", "AppleInterfaceStyle"])`
   — returns `Dark` when dark, errors (non-zero) when light. Synchronous, zero
   contention with Pi's stdin. Same mechanism already used for git in `amp-editor.ts`.
2. **OSC 11 terminal background query (fallback, non-macOS / SSH):** write
   `\x1b]11;?\x1b\\` and read the reply, infer dark/light from background luminance.
   Used only when (1) is unavailable. Must be implemented carefully because Pi owns
   stdin in raw mode — one-shot, time-bounded, restoring prior stdin state. If it
   cannot run safely or times out, fall through to (3).
3. **Manual setting (last resort):** an explicit `amp.appearance: "dark" | "light"`
   override, default `dark`.

**Sync timing (no appearance event exists in Pi):**

- On `session_start`: detect and apply.
- On every `before_agent_start`: re-detect and re-apply if changed. `defaults read`
  is cheap, so this covers OS flips between turns (sunset, manual toggle) without
  polling.
- Re-apply means: if the detected mode differs from the active theme, call
  `ctx.ui.setTheme("amp-dark" | "amp-light")`.

**Edge cases:** only auto-switch when the active theme is one of the amp themes (do
not override a user who has explicitly picked a non-amp theme). Detection failures
are non-fatal — fall back down the chain and never throw into the event loop.

### 2. Theme consolidation — `themes/`

- **Delete** `amp-gruvbox-dark-hard.json`.
- **Keep** `amp-dark.json` and `amp-light.json` as the two palettes the appearance
  module swaps between.
- **Single user-facing entry:** the suite presents one logical `amp` theme; the
  extension owns which palette is live. Concretely, the user sets `"theme": "amp-dark"`
  (or `amp-light`) as a seed and the appearance module keeps it in sync — both files
  stay registered via `package.json#pi.themes`. (Whether to additionally register an
  `amp` alias that resolves to the detected palette is an implementation detail to
  settle in the plan; the observable behavior is "pick amp, it follows the device.")
- Update `package.json#pi.themes` / `files` and README to drop gruvbox.

### 3. Editor status bar — `extensions/amp-editor.ts`

Match Amp's editor chrome. Reference layout:

```
╭─────────────────────────────────  $0.005 · ⚡<level> ─╮
│ ▌ <user input>                                         │
╰─ ~ Running tools ───────────  ~/Code/amp-themes (main) ─╯
```

- **Top-right border:** `$cost · ⚡<thinking-level>`. Cost hidden when `$0`.
  **Remove** model id and context-% from the chrome.
- **Bottom-left border:** the live agent working status, reflecting the real state
  (`Connecting` → `Waiting for response…` → `Running tools` → `Streaming response…`),
  driven by the existing working-state machine. Animated frame prefix retained.
- **Bottom-right border:** `cwd (branch)` — already produced by `getCwdLabel()`,
  unchanged (confirmed to match Amp, e.g. `~/Code/amp-themes (main)`).
- **Remove** the git-changes summary (`N files changed +x ~y -z`) — Amp does not show
  it. (`getGitChangesLabel()` and the separate status row that carried it go away;
  working status moves onto the bottom-left border.)
- **Working indicator:** replace the `setWorkingVisible?.(false)` cast with
  `ctx.ui.setWorkingIndicator({ frames: [] })` to hide Pi's built-in row, continuing
  to render our own status on the border. (Alternatively drive our frames through
  `setWorkingIndicator` — decide in the plan.)

### 4. Thinking label

Keep **Pi's native level names** (`off/minimal/low/medium/high/xhigh`) and the
existing synced thinking colors — only the **position/format** aligns to Amp: render
as `⚡<level>` in the top-right of the editor chrome (the `⚡` is a position marker and
may be dropped trivially if undesired). No remap to Amp's `deep³` naming. Colors
continue to come from the `thinkingOff…thinkingXhigh` theme tokens and stay in sync
with the user-message accent.

### 5. Library upgrade

- Bump `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui`
  peer/dev dependencies to `^0.78.0`.
- Adopt `setWorkingIndicator` (item 3).
- Keep all existing tests green; add coverage for new behavior.

---

## P2 — Self-authored tool display — `extensions/amp-tool-display.ts` (new)

Replace the bundled third-party `pi-tool-display` with our own Amp-styled renderer,
and remove the dependency (which also sheds its legacy `@mariozechner` namespace
coupling).

### Mechanism

For each built-in tool (`read`, `grep`, `find`, `ls`, `bash`, `edit`, `write`),
re-register the same name via `pi.registerTool({ name, execute, renderCall,
renderResult })`, delegating `execute` to the public `createXTool(cwd)` factory so we
change only presentation, never behavior. MCP tools are wrapped generically via
`pi.getAllTools()`. (Evaluate `wrapRegisteredTool` as a cleaner alternative to
full re-registration during the plan.)

### Rendering (Amp style)

- **Header / call line:** `<spinner|✓> <Verb> <count> <▸|▾>` collapsed/expanded, e.g.
  `✓ Explored 1 search ▾`, `⠿ Exploring 1 search ▾`. A per-tool verb map drives the
  label (`web search → "Searched web:" / "Exploring"`, `read → "Read"`,
  skill/glob/grep → `"Explored"`, `bash → "$ <command>"`, …).
- **Bash call line:** `⠋ $ <command> · 5s` — braille spinner + elapsed timer while
  running (port of `bash-display.ts`, ~150 lines).
- **Collapse/expand:** read `context.expanded` / `options.expanded`; slice to a
  collapsed preview (≈8 lines) vs an expanded cap. No custom toggle state.
- **Output truncation:** use public `truncateHead` / `truncateTail`.
- **Diff body (edit/write):** call public `renderDiff()` — do **not** re-implement
  diff rendering. Use `jsdiff` (already a transitive dep) only if custom word-level
  highlighting is needed beyond `renderDiff`.

### Inventory — what leaving `pi-tool-display` removes (must be covered or consciously dropped)

| Capability | Disposition |
|------------|-------------|
| Tool call/result rendering | Re-authored in P2 |
| Native user-message box | Already covered by `amp-user-message.ts` |
| Thinking-label context sanitization (strips `Thinking:` before LLM) | **Not needed** — our `⚡<level>` lives in the status bar, never in message content |
| Bash call line (`$ cmd` + spinner + timer) | Re-authored in P2 |
| MCP tool detection / rendering | Re-authored generically in P2 |
| Config modal / settings inspector / zellij modal | Dropped — not needed |

### Cleanup

- Remove `pi-tool-display` from `dependencies`, `bundledDependencies`, and
  `package.json#pi.extensions`.
- Update README ("bundled pi-tool-display") and the `amp-themes` metadata regression
  tests accordingly.

---

## Testing

- Keep the existing 32 tests green throughout.
- **Appearance module:** unit-test the detection chain (macOS `Dark`/light/error,
  fallback ordering, "don't override non-amp theme", failure is non-fatal) by
  injecting the exec + OSC probe rather than shelling out.
- **Status bar:** extend `amp-themes`/editor tests for the new top-right
  (`$cost · ⚡<level>`, cost hidden at `$0`), removed model/context/git-summary, and
  working-status-on-border rendering.
- **Thinking label:** assert native level names + synced colors in the new position.
- **Tool display (P2):** snapshot-style tests for header verbs, collapsed vs expanded
  (`expanded` flag), bash spinner line, and that `renderResult` delegates diffs to
  `renderDiff`.
- **Metadata regression:** update tests that assert bundled `pi-tool-display` and the
  gruvbox theme.

## Rollout / sequencing

1. P1 on this branch → review → release (minor bump).
2. P2 on a follow-up branch → review → release.

Sequencing is for reviewability and incremental shipping; it does not cut scope.

## Open implementation details (resolve in the plan, not blocking)

- Exact `amp` theme registration shape (alias vs seed-and-sync).
- Whether to drive our working frames *through* `setWorkingIndicator` or just hide it
  and render on the border.
- `wrapRegisteredTool` vs same-name `registerTool` for tool overrides.
- Confirm `setWorkingIndicator` / `renderDiff` signatures post-0.78 bump.
