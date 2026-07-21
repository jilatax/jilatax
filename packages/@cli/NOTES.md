# @jilatax/cli — First Publish

This file is a manual guide. The package skill does not execute these commands or create the workflow described below.

```bash
# Login (only once)
npm login --auth-type=web

# Verify session
npm whoami

# Check if the package name is available
npm view @jilatax/cli

# Review the files that will be published
npm pack --dry-run

# Publish
npm publish
```

<!-- -- -- --- ---- --- TODO: Update --- --- --- -- - -->

# Verify `@jilatax/cli` NPM package ✅

## 1 — npm Token **Settings**

```text
https://www.npmjs.com/package/@jilatax/cli/access
```

| Field | Value |
| --- | --- |
| Organization or user | `jilatax` |
| Repository | `jilatax` |
| Workflow filename | `cli.yml` |
| Environment name | None |
| Allowed actions | `Allow npm publish` |

Select **Set up connection**.

## 2 — Create the workflow manually

The workflow is located at `.github/workflows/cli.yml`:

```yaml
name: Publish @jilatax/cli

on:
  push:
    tags:
      - "cli-v*"

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Build jilatax
        working-directory: packages/jilatax
        run: bun run build

      - name: Build @jilatax/cli
        working-directory: packages/@cli
        run: bun run build

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          registry-url: "https://registry.npmjs.org"

      - name: Update npm
        run: npm install -g npm@latest

      - name: Publish @jilatax/cli with provenance
        working-directory: packages/@cli
        run: npm publish --provenance --access public
```

Commit and push the workflow to `main` manually.

## 3 — Publish and deploy

```bash
git checkout main
git pull
```
**Package version:** `0.1.1`

```bash
git tag -a cli-v0.1.1 -m "cli 0.1.1"
git push origin cli-v0.1.1
```

> Use the tag created by `npm version`; update the example tag when the version changes.
