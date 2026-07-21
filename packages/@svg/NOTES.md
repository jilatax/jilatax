# @jilatax/svg — Release

The package is published from the monorepo by `.github/workflows/svg.yml`.
The workflow uses npm trusted publishing with provenance; it does not require an
`NPM_TOKEN` repository secret.

## npm trusted publisher

Configure the package connection at:

```text
https://www.npmjs.com/package/@jilatax/svg/access
```

| Field | Value |
| --- | --- |
| Organization or user | `jilatax` |
| Repository | `jilatax` |
| Workflow filename | `svg.yml` |
| Environment name | None |
| Allowed actions | `Allow npm publish` |

## Release checklist

After updating `name` or `version` in `package.json`, verify from
`packages/@svg`:

```bash
bun run check
npm pack --dry-run
```

Commit the complete release, merge it to the branch used for publishing, and
create a tag whose version exactly matches `package.json`:

```bash
git tag -a svg-v<version> -m "svg <version>"
git push origin svg-v<version>
```

The tag namespace must remain `svg-v*`; a plain `v*` tag publishes `jilatax`
instead. Confirm the completed workflow and then verify the registry:

```bash
npm view @jilatax/svg version
```
