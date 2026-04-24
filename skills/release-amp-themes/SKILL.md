---
name: release-amp-themes
description: Use when preparing, committing, pushing, or publishing a new amp-themes npm release, especially after UI, theme, README screenshot, bundled dependency, or package file changes.
---

# Release amp-themes

## Overview

Release `amp-themes` only after proving the npm version is new, package contents are intentional, GitHub has the release commit and tag, GitHub Release notes describe the change, and Pi can load the package.

This repo can include README screenshots, but screenshots must stay repo-only unless explicitly intended for npm.

## Release flow

1. Inspect state:

```bash
git status --short
npm view amp-themes version
npm view amp-themes versions --json
```

2. Pick a new version that is not already on npm. Update:

- `package.json`
- `CHANGELOG.md`

3. Verify package behavior and contents:

```bash
npm run release:check
```

Read the `npm pack --dry-run` output. Confirm these are present:

- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `extensions/`
- `themes/`
- `skills/`
- bundled `pi-tool-display`

Confirm repo-only screenshots are absent unless intentionally packaged:

```text
screenshots/amp-gruvbox-dark-hard.png
```

4. Commit all intended release changes:

```bash
git add AGENTS.md CHANGELOG.md README.md extensions package.json themes skills screenshots
git commit -m "chore: release <version>"
```

Use a feature/fix subject instead if the commit is not only release prep.

5. Push GitHub before publishing:

```bash
git push origin HEAD
```

6. Create and push the release tag before publishing:

```bash
git tag v<version>
git push origin v<version>
```

7. Publish only after the commit and tag are on GitHub:

```bash
npm publish
```

8. Create GitHub Release notes from the changelog entry:

```bash
gh release create v<version> \
  --title "amp-themes <version>" \
  --notes-file /tmp/amp-themes-<version>-release-notes.md
```

Include user-visible changes and packaging notes, especially whether screenshots are repo-only.

9. Verify npm and GitHub release state:

```bash
npm view amp-themes version
npm view amp-themes dist-tags --json
gh release view v<version>
```

## Common mistakes

| Mistake | Prevention |
| --- | --- |
| Publishing an existing version | Check `npm view amp-themes versions --json` before release. |
| Accidentally packaging screenshots | Read `npm pack --dry-run`; keep `screenshots` out of `package.json.files`. |
| Publishing before GitHub push | Push the release commit and tag before `npm publish`. |
| Missing release notes | Create a GitHub Release from the changelog entry. |
| Trusting a partial check | Run full `npm run release:check`. |
| Forgetting bundled dependency evidence | Confirm dry-run lists bundled `pi-tool-display`. |

## If publish fails

- Version already exists: bump patch, update changelog, rerun `npm run release:check`, amend or make a new commit, push commit and tag, publish.
- Tag already exists: verify it points at the published commit with `git rev-parse v<version>` before reusing it.
- GitHub Release already exists: update it with `gh release edit v<version> --notes-file ...`.
- Auth failure: run `npm whoami`; do not change package contents until auth is fixed.
- Package contents wrong: fix `package.json.files` or ignore rules, rerun `npm run pack:check`, then rerun full release check.
