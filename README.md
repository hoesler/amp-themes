# amp-themes

[Amp](https://ampcode.com)-inspired UI for [Pi](https://pi.dev): Amp dark/light themes that auto-switch to follow device appearance, rounded editor chrome, synchronized thinking-level colors, compact user messages, and self-authored Amp-style tool rendering.

## Install

```bash
pi install npm:amp-themes
```

Set the theme in Pi settings, or in `~/.pi/agent/settings.json`:

```json
{
  "theme": "amp-dark"
}
```

## Includes

- `amp-dark` and `amp-light` themes (auto-switching to follow the device appearance; set `AMP_APPEARANCE=dark` or `AMP_APPEARANCE=light` to force)
- Amp-style editor chrome: session cost top-left, model · thinking-level · context-window usage top-right, live working status and `cwd (branch)` on the bottom border
- Working status integrated into the editor bottom border, with cwd and branch on the right
- Compact Amp-style user messages with thinking-level color sync
- Self-authored Amp-style tool rendering for the built-in tools (read, grep, find, ls, bash, edit, write): compact headers, collapsed output previews, a live bash spinner, and colored edit diffs (MCP tools keep Pi's default rendering)

## Third-party status labels in the model/thinking row

The editor chrome fully replaces Pi's built-in footer, so `ctx.ui.setStatus()` calls from other extensions never render. Instead, any extension can prepend a short label (e.g. a mode/preset name) to the model/thinking indicator via a tiny, dependency-free `globalThis` contract — no import of `amp-themes` required:

```ts
type AmpEditorStatusHook = () => string | undefined;

function ampEditorStatusHooks(): Set<AmpEditorStatusHook> {
  const g = globalThis as typeof globalThis & { __ampEditorStatusHooks?: Set<AmpEditorStatusHook> };
  if (!g.__ampEditorStatusHooks) g.__ampEditorStatusHooks = new Set();
  return g.__ampEditorStatusHooks;
}

// Register once, e.g. at the top of your extension's activation function.
// Return a short label to show, or undefined/"" to contribute nothing right now.
ampEditorStatusHooks().add(() => "mode:high");
```

- Every registered hook is called on each render; thrown errors are ignored so a misbehaving hook never breaks the editor.
- Non-empty results from all registered hooks are joined with " · " and prepended to the existing `model · thinking` text, e.g. `mode:high · claude-sonnet-5 · high`.
- If no hooks are registered, the row is unchanged from today.

`extensions/amp-editor-status-hooks.ts` exports `registerAmpEditorStatusHook`/`collectAmpEditorStatusLabel` helpers with the exact same shape, purely for convenience — you do not need to depend on this package to use the contract.

## Development

```bash
npm install
npm test
npm run typecheck
npm run check
npm run pack:check
```

For local Pi testing:

```bash
pi install /Users/frank/Code/amp-themes
```

Switch back to the published package when done:

```bash
pi remove /Users/frank/Code/amp-themes
pi install npm:amp-themes
```

## Release

Use the bundled release skill/checklist:

```text
release-amp-themes
```

At minimum:

```bash
npm run release:check
npm publish
```

See `CHANGELOG.md` for release notes.

## License

MIT
