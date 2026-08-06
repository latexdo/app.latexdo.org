# app.latexdo.org

This repository hosts the LatexDo desktop app download and update metadata at `https://app.latexdo.org`.

## Repository Role

- Serves the public downloads page under `/downloads/`.
- Serves the app update feed under `/updates/`.
- Serves the latest unsigned downloads manifest at `/downloads/manifest.json`.
- Receives release publications from `latexdo/latexdo` after the desktop release workflow passes.

The main website should link or redirect download/update traffic here instead of storing release metadata itself.

## Important URLs

- `https://app.latexdo.org/downloads/`
- `https://app.latexdo.org/downloads/manifest.json`
- `https://app.latexdo.org/downloads/releases.json`
- `https://app.latexdo.org/updates/latest.json`

## Requirements

- Node.js 22.17 or newer.
- npm.

## Validate

```sh
npm test
```

The validator checks that required static files exist, JSON metadata is well formed, release manifests match checksums, app/update URLs point at `app.latexdo.org`, route/header config is present, `updates/latest.json` matches the newest release, schema-2 signed feeds verify against `update-public-key.pem`, and stale `latexdo.org/downloads` or `latexdo.org/updates` URLs cannot come back.

## CI

GitHub Actions runs `npm run ci` on pushes, pull requests, and workflow dispatches from `latexdo/latexdo`. The dispatch path validates the source repository, source SHA, source run ID, and source run URL before checking the static download/update metadata.

## Deploy

Cloudflare deploys this repository through its GitHub integration. The Workers static assets deployment is configured in `wrangler.jsonc`.

```sh
npx wrangler deploy
```

## Publication Flow

The desktop app release workflow in `latexdo/latexdo`:

1. Builds and verifies installers.
2. Publishes installer assets to GitHub Releases.
3. Generates `downloads/` and `updates/` with `LATEXDO_DOWNLOAD_BASE_URL=https://app.latexdo.org`.
4. Pushes only `downloads/` and `updates/` into this repository.
