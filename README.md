# amp-themes

[Amp](https://ampcode.com)-inspired UI for [Pi](https://pi.dev): Amp dark/light themes that auto-switch to follow device appearance, rounded editor chrome, synchronized thinking-level colors, compact user messages, and bundled compact tool rendering.

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

- `amp-dark` and `amp-light` themes (auto-switching to follow the device appearance; set `AMP_APPEARANCE=dark` or `AMP_APPEARANCE=light` to force)
- Amp-style editor chrome: session cost and thinking level top-right, live working status and `cwd (branch)` on the bottom border
- Working status integrated into the editor bottom border, with cwd and branch on the right
- Compact Amp-style user messages with thinking-level color sync
- Bundled `pi-tool-display`

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
