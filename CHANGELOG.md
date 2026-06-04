# Changelog

## 0.4.1

- Replace the bundled third-party `pi-tool-display` with self-authored, Amp-style rendering for Pi's built-in tools (read, grep, find, ls, bash, edit, write): compact headers, collapsed output previews, a live bash spinner, and colored edit diffs. Tools we don't override (including MCP tools) keep Pi's default rendering. Drops the `pi-tool-display` dependency and its legacy `@mariozechner` coupling.
- Collapsed tool output now shows how to expand it — `… (N more lines, ctrl+o to expand)` — matching Pi's built-in renderers (the keybinding follows any user rebinding).
- Truncation notices match Pi verbatim: warning-colored `[Truncated: …]` / `[First line exceeds … limit]` per tool, and bash's `[Full output: …. Truncated: …]`.
- The `read` header line range is 1-indexed with an inclusive end (`read file:1-15`), and the `write` result reports the file's total line count.
- Show context-window usage in the editor top-right: `model · thinking · 45%` (Pi's `getContextUsage().percent`, hidden when usage is unknown).

## 0.4.0

- Rework the status-bar layout: session cost sits alone on the top-left; the model id and thinking level (effort) are grouped on the top-right (e.g. `sonnet-4 · high`). Cost is always shown, even at `$0.000`.
- Redesign the working-status copy into terse, hook-accurate phases: **Waiting** (request sent, awaiting the model), **Thinking** (reasoning — detected from the `thinking_*` assistant stream events), **Streaming** (text output), and **Using tools** (tool execution).
- Drop the thinking-level lightning glyph and the "Esc to cancel" hint.
- Fix Pi's built-in working row not hiding: use `setWorkingVisible(false)` (the official 0.78 row toggle) instead of `setWorkingIndicator({ frames: [] })`, which only suppresses the spinner animation.
- Tint the thinking level by effort (low→green, medium→cyan, high→orange, xhigh→red).

## 0.3.0

- Auto-switch between `amp-dark` and `amp-light` to follow the device appearance: detected via the macOS system setting (`AppleInterfaceStyle`) with an OSC 11 terminal-background parser as a fallback. Re-checked on session start and before every agent turn.
- Add an `AMP_APPEARANCE` environment variable (`dark` or `light`) to force the appearance, overriding auto-detection.
- Remove the `amp-gruvbox-dark-hard` theme; the suite is now a single auto-switching `amp` theme (dark/light).
- Rework the editor chrome to match Amp: the top-right shows `$cost · ⚡<thinking-level>` (model id and context percentage removed), the live agent working status moves onto the bottom-left border, and `cwd (branch)` stays on the bottom-right. The git change summary is removed.
- Hide Pi's built-in working row via the official `setWorkingIndicator` API instead of an unofficial cast.
- Stop computing unused git change statistics on every render.
- Upgrade Pi peer/dev dependencies to 0.78.

## 0.2.17

- Move amp-themes extension imports and Pi peer/development dependencies to the new `@earendil-works` package namespace.
- Keep bundled `pi-tool-display` unchanged for now while its upstream package still uses the legacy `@mariozechner` namespace.
- Add regression coverage for amp-themes package metadata and extension source imports so the main package does not drift back to the legacy Pi namespace.

## 0.2.16

- Require Pi 0.73 development types and use current thinking-level APIs directly.
- Update Amp editor and user-message rendering from session-derived thinking fallback to `thinking_level_select` event state.
- Deduplicate dynamically discovered command-palette entries from Pi command discovery.

## 0.2.15

- Fix command palette rows for multi-line skill descriptions so text cannot leak outside the overlay.
- Match Pi slash-command semantics: interactive built-in and extension commands run on Enter, while skill and prompt commands insert into the editor for review.
- Keep Tab as insert-only for every command source, and add regression coverage for command-source behavior.

## 0.2.14

- Rework `amp-gruvbox-dark-hard` to use the canonical Gruvbox dark hard palette.
- Color editor input text through the theme `text` token for consistent theme-specific editor rendering.
- Keep Pi's built-in working loader row hidden during agent starts while showing Amp's own `Esc to cancel` status hint.

## 0.2.13

- Update README to describe the latest editor working-status and color-sync behavior.

## 0.2.12

- Keep Amp user message colors synchronized with editor thinking colors after extension reloads.
- Add regression coverage for user message prototype state refresh across reloads.

## 0.2.11

- Hide Pi's built-in working loader row when supported.
- Render Amp working state in the existing editor status row while keeping git status on the right.

## 0.2.10

- Add an Amp-style overlay command palette for slash commands.
- Include built-in interactive commands alongside extension, prompt, and skill commands.
- Support palette filtering, scrolling, paging, and clearing the query.

## 0.2.9

- Keep Amp-style user message coloring in sync with runtime thinking-level changes.

## 0.2.8

- Add `amp-dark` and `amp-light` themes based on Amp's dark/light palette.
- Fix Amp editor borders so thinking-level color changes apply when cycling thinking levels.
- Validate bundled theme files include every required Pi theme color token.

## 0.2.7

- Refresh editor context and cost stats after `/reload` by reading the latest extension context.
- Move tests to Vitest and include them in `release:check`.

## 0.2.6

- Keep Amp editor thinking state stable after resumed sessions that lack a thinking-level entry.
- Preserve working-message order across waiting, streaming, and tool execution events.
- Avoid setting a custom working message while idle, and avoid restoring Pi's default message at agent end.
- Use a GitHub-hosted README screenshot so npm can render it without packaging the image.
- Simplify the README.

## 0.2.5

- Replace the working indicator with Amp-style `~ → ≈ → ≋` animation.
- Show `Waiting for response...` before the assistant starts and only switch to `Streaming response...` once assistant updates arrive.
- Show `Running tools...` while tool executions are active.
- Avoid stale session context crashes in Amp user message rendering after session replacement or reload.
- Darken the theme page background.
- Add a README screenshot as a repo-only asset.
- Add a release skill to keep npm publishing steps consistent.

## 0.2.4

- Published package maintenance update.

## 0.2.3

- Move git change summary out of the editor border and right-align it below the editor.
- Split git change summary into added, modified, and removed counts with theme-aware colors.
- Keep the editor bottom border focused on cwd and branch only.
- Tighten Amp-style user message rendering by removing the gap after the leading bar.

## 0.1.0

Initial release.

- Add `amp-gruvbox-dark-hard` Pi theme.
- Add Amp-inspired custom editor chrome.
- Show context usage and real session cost from Pi session usage data.
- Show model id and `pi.getThinkingLevel()` in the editor border.
- Show cwd, git branch, and dirty diff summary in the editor border.
- Add Amp-style working indicator.
- Bundle `pi-tool-display` for compact tool rendering.
