# hurl.page action

Deploy any HTML file, zip, or directory to [hurl.page](https://hurl.page) — instant anonymous hosting, no auth, no setup. Get a live URL back.

## Usage

```yaml
- uses: bitgate/ship-page-action@v1
  id: deploy
  with:
    path: dist
- run: echo "Live at ${{ steps.deploy.outputs.url }}"
```

## Free vs paid hurls

The snippet above needs **no account** — anonymous hurls are the default:

- No signup, no secrets. Just `path:`.
- Live for **7 days** (or sooner with `ttl`), up to **100 files** per drop, ~10 deploys/min per IP.
- Built for throwaway CI artifacts and PR previews.

Want them to stick around and unlock more? **[Create an account →](https://hurl.page/dashboard)**, mint an API key, and pass it as `api-key`:

- **No expiry** (or set any `ttl` you like), up to **900 files** per request and **chunked uploads to 10,000 files**.
- **Named drops** — one stable URL per PR across redeploys (`name: pr-${{ github.event.number }}`).
- **Vanity subdomains** on the Team plan (`acme--pr-42.shipped.page`).
- 120 deploys/min per account.

Pro is $4/mo, Team is $19/mo. Pass the key via `api-key:` or the `SHIP_API_KEY` env var (see [Auth via env var](#auth-via-env-var)).

## Auto-detect & engine presets

Don't want to remember where your tool writes its report? Point the action at an **engine** instead of a path — or give it nothing and let it find everything:

```yaml
# Zero config — auto-detects every known report in the workspace
- uses: bitgate/ship-page-action@v1

# Or name the engine (handy when the default path is tool-specific)
- uses: bitgate/ship-page-action@v1
  with:
    engine: jacoco            # probes the Gradle path, then the Maven path
```

- **1 report found** → deployed directly; the URL lands straight on it.
- **2+ found** (or an explicit list like `engine: playwright,jacoco`) → all bundled into one drop behind a **branded switcher page** (top nav + report dropdown) — one URL, every report.

Known engines: `playwright`, `jacoco`, `gradle-test`, `coverage-py` (htmlcov), `storybook`, `allure`. Reports with no fixed default path (e.g. self-contained `pytest-html`, `go cover`) still take an explicit `path:`.

`working-directory:` scopes detection to a subdir (monorepos); `root-file:` sets the entry page when it isn't `index.html` (e.g. Robot Framework's `report.html`), injecting a redirect so the URL opens on the right page.

## Example: publish a Playwright report

```yaml
- uses: bitgate/ship-page-action@v1
  id: report
  if: always()
  with:
    path: playwright-report
    api-key: ${{ secrets.SHIP_API_KEY }}
- if: always()
  run: echo "🎭 Playwright report: ${{ steps.report.outputs.url }}" >> "$GITHUB_STEP_SUMMARY"
```

## Example: PR preview channel (named drop)

Redeploying the same `name` replaces the content but keeps the URL — one stable link per PR, no new URL every push. With `comment: true` the action also posts a sticky PR comment with the link (updated in place on every push):

```yaml
permissions:
  pull-requests: write

steps:
  - uses: bitgate/ship-page-action@v1
    with:
      path: dist
      name: pr-${{ github.event.number }}
      api-key: ${{ secrets.SHIP_API_KEY }}
      comment: true
```

If the account has a vanity subdomain claimed (team plan), named drops serve at `https://<sub>--<name>.shipped.page/`.

## Filtering files

`include` / `exclude` take newline-separated glob patterns, matched against each file's path relative to `path`. `*` also crosses `/`, so `*.map` matches nested files too:

```yaml
- uses: bitgate/ship-page-action@v1
  with:
    path: dist
    exclude: |
      *.map
      __tests__/*
```

Or whitelist:

```yaml
    include: |
      *.html
      assets/*
```

Rules: `exclude` wins over `include`; `.git` is always excluded from directory deploys. Filters apply to directory and `.zip` deploys (a zip with filters set is unpacked, filtered, and repacked); they're ignored for single `.html` deploys. If filtering leaves zero files, the step fails.

## Inputs

| Input | Required | Description |
|---|---|---|
| `path` | no | What to deploy: a `.html`/`.htm` file (single page), a `.zip` (multi-file site), or a directory (zipped & deployed). Omit it to auto-detect a known report — see `engine` |
| `api-key` | no | hurl.page API key (`sp_...`) — pass via `secrets`. Falls back to a `SHIP_API_KEY` env var if unset. Raises the per-request cap to 900 files and enables chunked uploads, named drops, and custom `ttl` beyond free limits |
| `name` | no | Named drop alias (1–41 chars of `[a-z0-9-]`, no `--`). Stable URL across redeploys. Requires `api-key` with an active subscription |
| `ttl` | no | Drop lifetime in seconds (min 60). Default: 7 days anonymous/free, no expiry for subscribers. Free plan caps `ttl` at 7 days |
| `include` | no | Newline-separated globs — when set, only matching files are deployed (directory/zip deploys) |
| `exclude` | no | Newline-separated globs to skip. Wins over `include`; `.git` always excluded |
| `comment` | no | `true` posts/updates a sticky PR comment with the deploy URL. Needs `pull-requests: write` permission (no-op on non-PR events) |
| `github-token` | no | Token used for the PR comment. Default: `github.token` |
| `base-url` | no | Override the hurl.page endpoint (staging/self-hosted). Default: `https://hurl.page` |
| `engine` | no | Report preset(s) to auto-detect instead of a manual `path`. `auto` (also the default when `path` and `engine` are both empty) probes every known report and deploys all it finds — 1 lands directly, 2+ get a branded switcher. A name scopes to one; a comma list forces a set. Known: `playwright`, `jacoco`, `gradle-test`, `coverage-py`, `storybook`, `allure` |
| `working-directory` | no | Scopes the whole action (detection, path resolution, staging) to this dir — for monorepos |
| `root-file` | no | Entry file the URL opens on (e.g. `report.html`). When not `index.html`, a redirect `index.html` is injected |

## Outputs

| Output | Description |
|---|---|
| `url` | Public URL of the deployed site — every drop mounts at its own subdomain root (`https://<slug>.shipped.page/`), so absolute paths like `/app.js` just work |
| `slug` | Deployment slug |
| `expires_at` | ISO timestamp when the drop expires (empty = never) |
| `replaced` | `true` when a named drop redeploy replaced existing content |

## Large drops (chunked upload)

hurl.page caps a single request at 100 files (free) / 900 files (subscription). If your directory or zip has more, the action automatically splits it into batches of 900: the first goes to `POST /deploy`, the rest are appended via `POST /deploy/<slug>`. The final site is identical to a one-shot deploy.

Requirements: the `api-key` input must be set and the key needs an active subscription (appending is a paid feature — the step fails with the API's error otherwise). Hard limit: 10,000 files per drop.

## Auth via env var

Instead of wiring `api-key:` on every step, you can set the token once at workflow or job level — the action picks up `SHIP_API_KEY` automatically:

```yaml
env:
  SHIP_API_KEY: ${{ secrets.SHIP_API_KEY }}
```

The `api-key` input wins if both are set. Either way the key is only ever sent as an `Authorization` header to hurl.page — never in URLs or logs.

## Notes

- Anonymous/free drops expire after 7 days (or sooner with `ttl`) — perfect for CI artifacts, not for production hosting. Subscriber drops never expire unless `ttl` is set.
- Rate limit: ~10 deploys/min/IP anonymous, 120/min for subscribers. On 429 the action retries 3× with increasing backoff before failing.
- Every deploy writes URL, slug, and expiry to the job summary automatically.
- User content is served only on `*.shipped.page`; the `url` output already points there.
