# Design: Publish pi-caveman to npm via Trusted Publishing

Date: 2026-06-29
Status: Approved

## Goal

Make `pi-caveman` installable from the public npm registry and publish it
automatically from CI, using npm **Trusted Publishing** (OIDC) — no long-lived
`NPM_TOKEN` stored anywhere.

## Constraints / facts established

- The bare name `pi-caveman` is already owned on npm by `jonjonrankin`
  (currently v1.0.7). We cannot publish under it. → publish under the scoped
  name **`@kulapard/pi-caveman`** (matches the GitHub owner `kulapard`).
- Pi loads `.ts` extensions directly, so there is **no compile step**. We ship
  the TypeScript source (`extensions/*.ts`) and the `skills/` tree as-is.
- Git origin already exists: `github.com/kulapard/pi-caveman` (the README's
  "no published origin remote" note is stale and will be corrected).
- Trusted Publishing requirements (npm docs): npm CLI **>= 11.5.1**, Node
  **>= 22.14**. No `NODE_AUTH_TOKEN`. Provenance is generated **automatically**
  (no `--provenance` flag). Workflow needs `id-token: write`.
- Trusted publisher is configured on the package's settings page on npmjs.com,
  which requires the package to **already exist** → the first publish is a
  one-time manual/local publish; CI takes over afterward.

## Changes

### 1. `package.json`

- `name`: `pi-caveman` → `@kulapard/pi-caveman`
- add `"publishConfig": { "access": "public" }` (scoped packages default to
  restricted; this keeps both the bootstrap and CI publishes public)
- add `"files": ["extensions", "skills", "agents", "AGENTS.md"]` — tarball
  whitelist (`package.json`, `README.md`, `LICENSE` are always included; tests,
  `docs/`, `tsconfig.json` are excluded)
- add `"repository"`, `"bugs"`, `"homepage"` pointing at
  `github.com/kulapard/pi-caveman`
- add `"prepublishOnly": "npm test"` — gate every publish on typecheck + node
  tests
- `version` stays `0.1.0` for the first publish
- the `pi` block is unchanged — `./extensions/caveman.ts` ships at that path in
  the tarball, so Pi resolves it from `node_modules` the same way

### 2. `.github/workflows/ci.yml`

On push and pull_request to `master`: `actions/setup-node` (Node 24) →
`npm ci` → `npm test`. Validates every change.

### 3. `.github/workflows/publish.yml`

Trigger: push of a tag matching `v*`.

```yaml
permissions:
  id-token: write   # OIDC for Trusted Publishing
  contents: read
```

- `test` job: `npm ci` → `npm test`
- `publish` job (needs `test`):
  - `actions/setup-node` with `node-version: 24` and
    `registry-url: https://registry.npmjs.org`
  - `npm install -g npm@latest` — guarantee npm >= 11.5.1
  - `npm ci`
  - `npm publish`  — no token, no `--provenance`, OIDC + provenance automatic

No repository secrets are required.

### 4. `tests/manifest.test.mjs`

- update the name assertion: `pkg.name === "@kulapard/pi-caveman"`
- add assertions that publish config stays present:
  - `pkg.publishConfig.access === "public"`
  - `pkg.files` includes `extensions`, `skills`, `agents`
- existing assertions (version, license, type, engines, keywords, pi block,
  devDependencies, scripts) stay; `prepublishOnly` may be covered too

### 5. `README.md`

- remove the stale "there is no published origin remote" claim
- add an npm install path: `pi install @kulapard/pi-caveman`
- keep the `pi -e` mechanism documented (the README test asserts it)

## Manual steps (operator: kulapard)

1. **Bootstrap once (local):** with the renamed package, `npm publish` (public
   via `publishConfig`) to create `@kulapard/pi-caveman@0.1.0`. Requires
   `npm login` first.
2. **Enable Trusted Publishing:** npmjs.com → package Settings → Trusted
   Publisher → user `kulapard`, repo `pi-caveman`, workflow `publish.yml`,
   allowed action `npm publish`.
3. *(optional hardening)* package Settings → "Require two-factor authentication
   and disallow tokens".
4. **Releases thereafter:** bump `version` → `git tag vX.Y.Z` → `git push
   --tags` → CI publishes via OIDC.

## Out of scope

- No TS→JS compile/`dist` step (Pi consumes `.ts` directly).
- No changelog/release-notes automation.
- No multi-registry (GitHub Packages) publishing.
