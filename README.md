# amp-themes

[Amp](https://ampcode.com)-inspired UI for [Pi](https://pi.dev): Amp dark/light themes, a Gruvbox dark theme, rounded editor chrome, synchronized thinking-level colors, compact user messages, and bundled compact tool rendering.

![amp-gruvbox-dark-hard screenshot](https://raw.githubusercontent.com/me-frankan/amp-themes/main/screenshots/amp-gruvbox-dark-hard.png)

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

If `npm:pi-tool-display` is installed separately, remove it. `amp-themes` already bundles it.

## Includes

- `amp-dark`, `amp-light`, and `amp-gruvbox-dark-hard` themes
- Amp-style editor chrome with context, cost, model, thinking level, cwd, branch, and git change summary
- Working status integrated into the editor status row, with git changes kept on the right
- Compact Amp-style user messages with thinking-level color sync
- Bundled `pi-tool-display`

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
