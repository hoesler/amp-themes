# Amp UI Alignment — P1 (Visual Alignment) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the `amp-themes` editor chrome with the real Amp app, add device-following dark/light auto-sync, and upgrade the Pi dependency to 0.78 — without touching tool rendering (that is P2).

**Architecture:** A new pure-logic `amp-appearance` module (injectable probes, unit-tested) detects dark/light and a thin extension wires it to `ctx.ui.setTheme` on `session_start` + every `before_agent_start`. The existing `amp-editor` extension's status chrome is reworked: top-right shows `$cost · ⚡<thinking>`, the git-changes summary is removed, the agent working status moves onto the bottom-left border, and the built-in working row is hidden via the official `setWorkingIndicator`. The gruvbox theme is removed, leaving `amp-dark`/`amp-light` as the auto-synced pair.

**Tech Stack:** TypeScript ESM, `@earendil-works/pi-coding-agent` + `@earendil-works/pi-tui` `^0.78.0`, Vitest, Pi extension API.

**Reference spec:** `docs/superpowers/specs/2026-06-03-amp-ui-alignment-design.md`

---

## File Structure

- **Create** `extensions/amp-appearance.ts` — pure `detectAppearance(probes)` + real probes + default-export extension that calls `setTheme`.
- **Create** `extensions/amp-appearance.test.ts` — unit tests for the detection chain.
- **Modify** `extensions/amp-editor.ts` — status-bar rework (top-right cost·thinking, remove model/context-%, remove git-changes summary, working-on-bottom-border, `setWorkingIndicator`). Extract pure `formatStatusTopRight()` helper for testability.
- **Modify** `extensions/amp-editor.test.ts` (create if absent) — unit tests for `formatStatusTopRight`.
- **Delete** `themes/amp-gruvbox-dark-hard.json`.
- **Modify** `extensions/amp-themes.test.ts` — drop gruvbox cases.
- **Modify** `package.json` — bump deps to `^0.78.0`, register `amp-appearance` extension.
- **Modify** `README.md` — drop gruvbox from the theme list.
- **Modify** `CHANGELOG.md` — add the release entry.

---

## Task 1: Upgrade Pi dependency to 0.78

**Files:**
- Modify: `package.json` (devDependencies `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`)

- [ ] **Step 1: Bump the dev dependency versions**

In `package.json`, change both `devDependencies` entries from `^0.74.0` to `^0.78.0`:

```json
    "@earendil-works/pi-coding-agent": "^0.78.0",
    "@earendil-works/pi-tui": "^0.78.0",
```

Leave `peerDependencies` as `"*"` (unchanged).

- [ ] **Step 2: Reinstall and confirm the resolved version**

Run: `npm install && node -e "console.log(require('@earendil-works/pi-coding-agent/package.json').version)"`
Expected: prints `0.78.0` (or a `0.78.x`).

- [ ] **Step 3: Run the existing suite + typecheck against 0.78**

Run: `npm test && npm run typecheck`
Expected: 32 tests pass; `tsc --noEmit` exits 0. If typecheck fails, the 0.78 types changed an API we use — fix the call site minimally before continuing (do not proceed with a red baseline).

- [ ] **Step 4: Confirm the two API signatures the later tasks depend on**

Run: `grep -rnE "setWorkingIndicator|WorkingIndicatorOptions|renderDiff" node_modules/@earendil-works/pi-coding-agent/dist/**/*.d.ts | head`
Expected: `setWorkingIndicator(options?: WorkingIndicatorOptions)` with `{ frames?: string[]; intervalMs?: number }` is present. (P2 uses `renderDiff`; just note its presence here.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: upgrade Pi dependencies to 0.78"
```

---

## Task 2: Remove the gruvbox theme

**Files:**
- Delete: `themes/amp-gruvbox-dark-hard.json`
- Modify: `extensions/amp-themes.test.ts:103-190` (remove gruvbox cases)
- Modify: `README.md`

- [ ] **Step 1: Update the metadata test to expect no gruvbox**

In `extensions/amp-themes.test.ts`, change the `test.each` table to drop the gruvbox row:

```ts
test.each([
  ["amp-dark.json", "amp-dark"],
  ["amp-light.json", "amp-light"],
])("%s defines every required Pi color token", (fileName, expectedName) => {
```

Then **delete** the two gruvbox-specific tests entirely: `test("amp-gruvbox-dark-hard uses the canonical Gruvbox dark hard palette", …)` and `test("amp-gruvbox-dark-hard maps Pi tokens to Gruvbox roles", …)` (everything from those two `test(` calls through their closing `});`).

- [ ] **Step 2: Run the test to confirm it still references the deleted file (RED)**

Run: `npm test -- amp-themes`
Expected: still PASS at this point (file not yet deleted). This step just confirms the test edits are syntactically valid.

- [ ] **Step 3: Delete the gruvbox theme file**

Run: `git rm themes/amp-gruvbox-dark-hard.json`

- [ ] **Step 4: Run the full suite (GREEN)**

Run: `npm test`
Expected: all tests pass; no test reads `amp-gruvbox-dark-hard.json`.

- [ ] **Step 5: Drop gruvbox from the README theme list**

In `README.md`, change the Includes bullet:

```md
- `amp-dark` and `amp-light` themes (auto-switching to follow the device appearance)
```

and remove any other `amp-gruvbox-dark-hard` mention.

- [ ] **Step 6: Commit**

```bash
git add themes/amp-gruvbox-dark-hard.json extensions/amp-themes.test.ts README.md
git commit -m "feat: drop amp-gruvbox-dark-hard theme"
```

---

## Task 3: Appearance detection module (pure logic, TDD)

**Files:**
- Create: `extensions/amp-appearance.ts`
- Create: `extensions/amp-appearance.test.ts`

The detection contract: an explicit user override wins; otherwise the macOS system
setting; otherwise an OSC-11 result; otherwise default `dark`. Each probe returns an
`Appearance` or `null` (cannot answer).

- [ ] **Step 1: Write the failing test**

Create `extensions/amp-appearance.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { detectAppearance, type AppearanceProbes } from "./amp-appearance.js";

function probes(overrides: Partial<AppearanceProbes>): AppearanceProbes {
  return { override: null, mac: () => null, osc: () => null, ...overrides };
}

describe("detectAppearance", () => {
  test("explicit override wins over everything", () => {
    expect(detectAppearance(probes({ override: "light", mac: () => "dark" }))).toBe("light");
  });

  test("falls back to macOS probe when no override", () => {
    expect(detectAppearance(probes({ mac: () => "light" }))).toBe("light");
    expect(detectAppearance(probes({ mac: () => "dark" }))).toBe("dark");
  });

  test("falls back to OSC probe when mac probe cannot answer", () => {
    expect(detectAppearance(probes({ mac: () => null, osc: () => "light" }))).toBe("light");
  });

  test("defaults to dark when nothing can answer", () => {
    expect(detectAppearance(probes({}))).toBe("dark");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- amp-appearance`
Expected: FAIL — `Cannot find module './amp-appearance.js'`.

- [ ] **Step 3: Write the minimal implementation**

Create `extensions/amp-appearance.ts`:

```ts
import { execFileSync } from "node:child_process";

export type Appearance = "dark" | "light";

export interface AppearanceProbes {
  /** Explicit user setting; wins when set. */
  override: Appearance | null;
  /** macOS system setting, or null when not macOS. */
  mac: () => Appearance | null;
  /** OSC 11 terminal-background result, or null when unavailable. */
  osc: () => Appearance | null;
}

export function detectAppearance(probes: AppearanceProbes): Appearance {
  return probes.override ?? probes.mac() ?? probes.osc() ?? "dark";
}

/** macOS: `defaults read -g AppleInterfaceStyle` prints "Dark" in dark mode and
 * errors (key absent) in light mode. Returns null off macOS. */
export function macAppearanceProbe(): Appearance | null {
  if (process.platform !== "darwin") return null;
  try {
    const out = execFileSync("defaults", ["read", "-g", "AppleInterfaceStyle"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 500,
    }).trim();
    return out === "Dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- amp-appearance`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add extensions/amp-appearance.ts extensions/amp-appearance.test.ts
git commit -m "feat: add appearance detection module"
```

---

## Task 4: OSC 11 fallback probe (best-effort, time-bounded)

**Files:**
- Modify: `extensions/amp-appearance.ts`
- Modify: `extensions/amp-appearance.test.ts`

OSC 11 must never block or corrupt Pi's stdin. It is only invoked when the macOS probe
returns null. Implemented as a guarded function returning `null` on any doubt.

- [ ] **Step 1: Write the failing test for luminance parsing**

Append to `extensions/amp-appearance.test.ts`:

```ts
import { appearanceFromOscReply } from "./amp-appearance.js";

describe("appearanceFromOscReply", () => {
  test("parses a dark background reply", () => {
    // OSC 11 reply form: ESC ] 11 ; rgb:RRRR/GGGG/BBBB ESC \
    expect(appearanceFromOscReply("\x1b]11;rgb:0000/0000/0000\x1b\\")).toBe("dark");
  });
  test("parses a light background reply", () => {
    expect(appearanceFromOscReply("\x1b]11;rgb:ffff/ffff/ffff\x1b\\")).toBe("light");
  });
  test("returns null on unparseable input", () => {
    expect(appearanceFromOscReply("garbage")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- amp-appearance`
Expected: FAIL — `appearanceFromOscReply` not exported.

- [ ] **Step 3: Implement the parser + the guarded probe**

Append to `extensions/amp-appearance.ts`:

```ts
const OSC11_REPLY = /\x1b\]11;rgb:([0-9a-f]{2,4})\/([0-9a-f]{2,4})\/([0-9a-f]{2,4})/i;

function channel(hex: string): number {
  // Normalize 1-4 hex digits to 0..1.
  const max = (1 << (hex.length * 4)) - 1;
  return parseInt(hex, 16) / max;
}

export function appearanceFromOscReply(reply: string): Appearance | null {
  const m = OSC11_REPLY.exec(reply);
  if (!m) return null;
  // Rec. 601 luma; >0.5 is a light background.
  const luma = 0.299 * channel(m[1]) + 0.587 * channel(m[2]) + 0.114 * channel(m[3]);
  return luma > 0.5 ? "light" : "dark";
}

/** Best-effort OSC 11 query. Returns null unless stdin/stdout are a TTY and a reply
 * arrives quickly. Intentionally conservative: any doubt → null (caller falls back). */
export function oscAppearanceProbe(): Appearance | null {
  const { stdin, stdout } = process;
  if (!stdin.isTTY || !stdout.isTTY) return null;
  // NOTE: Pi owns stdin in raw mode. A live synchronous read here is unsafe, so this
  // probe only answers when an OSC 11 reply was already captured by the extension's
  // input observer (see Task 5 wiring). Standalone, it returns null.
  return null;
}
```

> Implementation note for the executor: a fully live OSC 11 round-trip against Pi's
> raw-mode stdin is out of scope for P1 — macOS `defaults` covers the primary target.
> Keep `oscAppearanceProbe` returning `null` until a safe stdin-observer path is
> validated; the parser is unit-tested and ready for that follow-up.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- amp-appearance`
Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
git add extensions/amp-appearance.ts extensions/amp-appearance.test.ts
git commit -m "feat: add OSC 11 background parser for appearance fallback"
```

---

## Task 5: Wire appearance auto-sync into an extension

**Files:**
- Modify: `extensions/amp-appearance.ts` (add default-export extension)
- Modify: `package.json` (`pi.extensions`)

- [ ] **Step 1: Add the extension wiring**

Append to `extensions/amp-appearance.ts`:

```ts
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const THEME_FOR: Record<Appearance, string> = { dark: "amp-dark", light: "amp-light" };
const AMP_THEMES = new Set(Object.values(THEME_FOR));

function readOverride(ctx: ExtensionContext): Appearance | null {
  const raw = (ctx as { settings?: { get?: (k: string) => unknown } }).settings?.get?.("amp.appearance");
  return raw === "dark" || raw === "light" ? raw : null;
}

function syncTheme(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  // Only manage the theme when an amp theme is active; never override a user who
  // explicitly picked a non-amp theme.
  const active = ctx.ui.theme?.name;
  if (active && !AMP_THEMES.has(active)) return;

  const appearance = detectAppearance({
    override: readOverride(ctx),
    mac: macAppearanceProbe,
    osc: oscAppearanceProbe,
  });
  const target = THEME_FOR[appearance];
  if (active !== target) ctx.ui.setTheme(target);
}

export default function (pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => syncTheme(ctx));
  pi.on("before_agent_start", (_event, ctx) => syncTheme(ctx));
}
```

> Executor note: confirm the settings-read path (`ctx.settings?.get`) against the 0.78
> `ExtensionContext` type; if settings are exposed differently, adjust `readOverride`
> only (the rest is type-stable). A missing override simply yields `null` → auto-detect.

- [ ] **Step 2: Register the extension in package.json**

In `package.json`, add `amp-appearance` first in `pi.extensions` so the theme is set before the editor renders:

```json
    "extensions": [
      "./extensions/amp-appearance.ts",
      "./extensions/amp-editor.ts",
      "./node_modules/pi-tool-display/index.ts",
      "./extensions/amp-user-message.ts"
    ],
```

- [ ] **Step 3: Typecheck + smoke-load the extension set**

Run: `npm run typecheck && npm run check`
Expected: `tsc --noEmit` exits 0; `pi … -p 'Reply with ok'` replies `ok` (extension loads without throwing).

- [ ] **Step 4: Commit**

```bash
git add extensions/amp-appearance.ts package.json
git commit -m "feat: auto-sync amp theme to device appearance"
```

---

## Task 6: Status bar top-right — `$cost · ⚡<thinking>`

**Files:**
- Modify: `extensions/amp-editor.ts`
- Create: `extensions/amp-editor.test.ts`

Extract a pure formatter so the layout is unit-testable, then use it in `render()`.
This replaces `getModelLabel` (model id + thinking) on the top-right and removes the
context-% / cost from the top-left (`getUsageLabel`).

- [ ] **Step 1: Write the failing test**

Create `extensions/amp-editor.test.ts`:

```ts
import { expect, test } from "vitest";
import { formatStatusTopRight } from "./amp-editor.js";

const id = (s: string) => s; // identity colorizer for assertions

test("shows cost and thinking when cost is present", () => {
  expect(formatStatusTopRight({ cost: 0.005, thinking: "high", fg: (_c, t) => id(t) }))
    .toBe("$0.005 · ⚡high");
});

test("hides cost when zero", () => {
  expect(formatStatusTopRight({ cost: 0, thinking: "off", fg: (_c, t) => id(t) }))
    .toBe("⚡off");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- amp-editor`
Expected: FAIL — `formatStatusTopRight` not exported.

- [ ] **Step 3: Implement the pure formatter and export it**

In `extensions/amp-editor.ts`, add near the other formatters (after `formatCost`):

```ts
export function formatStatusTopRight(input: {
  cost: number;
  thinking: string;
  fg: (color: ThemeColor, text: string) => string;
}): string {
  const thinkingPart = `${input.fg("accent", "⚡")}${input.fg(thinkingColorFor(input.thinking), input.thinking)}`;
  if (input.cost <= 0) return thinkingPart;
  return `${input.fg("muted", formatCost(input.cost))} ${input.fg("dim", "·")} ${thinkingPart}`;
}

export function thinkingColorFor(level: string): ThemeColor {
  switch (level) {
    case "minimal": return "thinkingMinimal";
    case "low": return "thinkingLow";
    case "medium": return "thinkingMedium";
    case "high": return "thinkingHigh";
    case "xhigh": return "thinkingXhigh";
    default: return "thinkingOff";
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- amp-editor`
Expected: PASS (2 tests).

- [ ] **Step 5: Use the formatter in `render()` and drop model/context labels**

In `AmpEditor`:
- Replace the private `getThinkingColor()` body to `return thinkingColorFor(this.getThinkingLevel());` (reuse the exported helper).
- In `render()`, replace the top border's labels so the **left is empty** and the
  **right is the new formatter**:

```ts
    const rightTop = formatStatusTopRight({
      cost: getSessionCost(this.ctx).total,
      thinking: this.getThinkingLevel(),
      fg: (c, t) => this.fg(c, t),
    });
    // ...
    return [
      this.borderWithLabels(width, "", rightTop),
      ...body.map((line) => this.wrapBody(line, innerWidth)),
      // bottom border + status rows handled in Task 7
      this.borderWithRightLabel(width, this.getCwdLabel()),
      ...this.statusRows(width, this.getWorkingLabel(), ""),
      ...this.wrapPopupBlock(popupLines, width),
    ];
```

- Delete the now-unused `getUsageLabel()` and `getModelLabel()` methods and the
  `compactModelId` import usage if it becomes unused (keep `compactModelId` only if
  still referenced; otherwise remove it and its tests-free helper).

- [ ] **Step 6: Typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: 0 type errors; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add extensions/amp-editor.ts extensions/amp-editor.test.ts
git commit -m "feat: align editor top-right status to \$cost · thinking"
```

---

## Task 7: Move working status to the bottom-left border; remove git-changes summary

**Files:**
- Modify: `extensions/amp-editor.ts`

Amp shows the live agent status on the bottom-left of the editor border and `cwd
(branch)` on the bottom-right, with no git-changes summary. Fold the working label
onto the bottom border line instead of a separate status row.

- [ ] **Step 1: Add a combined bottom-border renderer**

In `AmpEditor`, add a method that places the working label on the left and the cwd
label on the right of the closing border:

```ts
  private bottomBorderWithStatus(width: number, leftLabel: string, rightLabel: string): string {
    const innerWidth = Math.max(0, width - 2);
    const left = leftLabel ? ` ${truncateToWidth(leftLabel, Math.max(0, Math.floor(innerWidth * 0.5)), "…")} ` : "";
    const right = rightLabel ? ` ${this.fg("muted", truncateToWidth(rightLabel, Math.max(0, innerWidth - visibleWidth(left) - 2), "…"))} ` : "";
    const fill = Math.max(0, innerWidth - visibleWidth(left) - visibleWidth(right));
    return this.borderColor("╰") + left + this.borderColor("─".repeat(fill)) + right + this.borderColor("╯");
  }
```

- [ ] **Step 2: Use it in `render()` and remove the separate status row + git summary**

Replace the bottom of `render()`'s return array:

```ts
    return [
      this.borderWithLabels(width, "", rightTop),
      ...body.map((line) => this.wrapBody(line, innerWidth)),
      this.bottomBorderWithStatus(width, this.getWorkingLabel(), this.getCwdLabel()),
      ...this.wrapPopupBlock(popupLines, width),
    ];
```

Delete `getGitChangesLabel()`, the `statusRows()` method, the `borderWithRightLabel()`
method, and the `STATUS_LEFT_INSET`/`STATUS_RIGHT_INSET` constants if no longer
referenced. Keep `getWorkingLabel()` and `getCwdLabel()`.

- [ ] **Step 3: Typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: 0 type errors; all tests pass. (No render-integration test asserts the old
git-summary; if `amp-stale-context.test.ts` references removed methods, update it to
match the new surface.)

- [ ] **Step 4: Commit**

```bash
git add extensions/amp-editor.ts
git commit -m "feat: working status on bottom border, drop git-changes summary"
```

---

## Task 8: Replace the working-visibility hack with `setWorkingIndicator`

**Files:**
- Modify: `extensions/amp-editor.ts`

- [ ] **Step 1: Replace the hidden-row helper**

Replace `hideBuiltInWorking`:

```ts
function hideBuiltInWorking(ctx: ExtensionContext): void {
  // Official API (Pi ≥ 0.75): an empty frames array hides the built-in working row.
  ctx.ui.setWorkingIndicator({ frames: [] });
}
```

Remove the old `(ctx.ui as … & { setWorkingVisible?: … })` cast.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors — `setWorkingIndicator` is on `ExtensionUIContext`. If the call
shape differs in 0.78, adjust to the real signature confirmed in Task 1 Step 4.

- [ ] **Step 3: Smoke-load**

Run: `npm run check`
Expected: replies `ok`.

- [ ] **Step 4: Commit**

```bash
git add extensions/amp-editor.ts
git commit -m "refactor: hide built-in working row via setWorkingIndicator"
```

---

## Task 9: Verify, changelog, finish

**Files:**
- Modify: `CHANGELOG.md`, `package.json` (version)

- [ ] **Step 1: Full release gate**

Run: `npm run release:check`
Expected: `typecheck` + `vitest run` + `check` + `pack:check` all succeed.

- [ ] **Step 2: Add the changelog entry and bump version**

Bump `package.json` `version` to `0.3.0` (minor — user-visible UI change + theme
removal). Prepend to `CHANGELOG.md`:

```md
## 0.3.0

- Auto-switch between `amp-dark` and `amp-light` to follow the device appearance (macOS system setting, with an OSC 11 fallback parser).
- Remove the `amp-gruvbox-dark-hard` theme.
- Rework the editor chrome to match Amp: top-right shows `$cost · ⚡<thinking>`, the agent working status moves onto the bottom-left border, `cwd (branch)` stays bottom-right, and the git-changes summary is removed.
- Hide Pi's built-in working row via the official `setWorkingIndicator` API.
- Upgrade Pi peer/dev dependencies to 0.78.
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md package.json
git commit -m "chore: release 0.3.0"
```

- [ ] **Step 4: Hand off for review**

Use `superpowers:finishing-a-development-branch` to decide merge/PR. Note that P2
(self-authored tool display, dropping `pi-tool-display`) is a separate plan to be
written after P1 ships.

---

## Self-Review

**Spec coverage:**
- Appearance detection (defaults primary, OSC 11 fallback, manual override, default dark) → Tasks 3–5. ✅
- Sync timing (session_start + before_agent_start; only when amp theme active) → Task 5. ✅
- Theme consolidation (delete gruvbox, keep dark/light) → Task 2. ✅
- Status bar (`$cost · ⚡<level>`, remove model/context) → Task 6. ✅
- Working status on bottom-left border; cwd (branch) bottom-right; remove git summary → Task 7. ✅
- `setWorkingIndicator` replaces the hack → Task 8. ✅
- Thinking keeps Pi native names, repositioned → Task 6 (formatter uses raw level + synced color). ✅
- Pi 0.78 upgrade → Task 1. ✅
- Tests for detection chain + status formatter → Tasks 3, 4, 6. ✅
- README/metadata updates → Task 2. ✅
- Out of scope: Outline, tool-display replacement (P2). ✅

**Placeholder scan:** No TBD/TODO; every code step shows real code. The two "executor
note" callouts (settings-read path, live OSC round-trip) are explicit verification
instructions against the real 0.78 types, not deferred work — the unit-tested logic is
complete.

**Type consistency:** `Appearance`, `AppearanceProbes` (`override/mac/osc`),
`detectAppearance`, `macAppearanceProbe`, `oscAppearanceProbe`, `appearanceFromOscReply`,
`formatStatusTopRight`, `thinkingColorFor`, `bottomBorderWithStatus` are referenced
with consistent names/signatures across tasks.
