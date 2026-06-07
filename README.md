# MaestroStack

MaestroStack is a config-driven CLI for running [Maestro](https://maestro.mobile.dev/)
mobile tests on [BrowserStack App Automate](https://www.browserstack.com/app-automate).

It packages Maestro flow folders, uploads app and test artifacts, and starts
BrowserStack Maestro builds across one or more real devices from a single command:

```bash
maestrostack run
```

Under the hood BrowserStack's Maestro workflow is several manual REST calls: upload
the app, upload a zipped suite, copy the returned URLs, hand-build a JSON payload
with the right devices and `execute` paths, and POST to the correct Android or iOS
build endpoint. MaestroStack turns that into one repeatable command you can run
locally or in CI.

## Install

```bash
npm install -g maestrostack
```

Requires Node.js 18+. Works on macOS, Linux and Windows.

## Quick start

```bash
# 1. Scaffold a config
maestrostack init --android

# 2. Provide BrowserStack credentials (see Authentication below)
export BROWSERSTACK_USERNAME=...
export BROWSERSTACK_ACCESS_KEY=...

# 3. Check everything before touching the network
maestrostack validate
maestrostack run --dry-run

# 4. Run on BrowserStack
maestrostack run
```

## Project layout

MaestroStack encourages this structure:

```text
mobile-tests/
├── maestrostack.yml      # tool config (NOT a Maestro flow)
├── smoke/
│   ├── login.yml         # Maestro flow
│   └── signup.yml
├── regression/
│   └── checkout.yml
└── apps/
    └── app-release.apk
```

> **Root-level YAML files are treated as config files, not Maestro flows.**
> Keep your Maestro flows inside subfolders. This avoids confusing
> `maestrostack.yml` (tool config) with `smoke/login.yml` (a test flow).

## Configuration

`maestrostack init` writes a starter `maestrostack.yml`. A full example:

```yaml
version: 1

auth:
  username: ${BROWSERSTACK_USERNAME}
  accessKey: ${BROWSERSTACK_ACCESS_KEY}

platform: android            # android | ios

app:
  source: upload             # upload | app_url
  path: ./apps/app-release.apk
  customId: SampleApp

suite:
  root: .
  packageName: Flows.zip
  customId: SampleTest
  include:
    - smoke/**/*.yml
    - regression/**/*.yml
  exclude:
    - apps/**

run:
  project: Maestro_Test
  devices:
    - Samsung Galaxy S20-10.0
    - Google Pixel 7-13.0
  executeMode: explicit      # explicit | main
  execute:
    - smoke/login.yml
    - smoke/signup.yml
    - regression/checkout.yml
  options:
    networkLogs: true
    deviceLogs: true
```

### App source

| `app.source` | Required fields | Notes |
|---|---|---|
| `upload`  | `path` | Uploads a local `.apk` (Android) / `.ipa` (iOS). |
| `app_url` | `appUrl` | Reuses an existing `bs://` app reference. |

### Execute modes

- **`explicit`** (recommended): list flow files in `run.execute`. MaestroStack
  sends them as the BrowserStack `execute` array - no root `main.yaml` needed.
- **`main`**: omit `run.execute` and provide a `main.yaml` at the suite root.
  BrowserStack runs it as the entrypoint.

### Authentication

Credentials are read from environment variables referenced as `${VAR}` in the
config. MaestroStack loads a `.env` file from the working directory if present:

```env
BROWSERSTACK_USERNAME=my_username
BROWSERSTACK_ACCESS_KEY=my_access_key
```

If a referenced variable is missing, MaestroStack fails *before* any upload.
Secrets are never printed.

## Commands

| Command | Description |
|---|---|
| `maestrostack init` | Create a starter config (`--android`, `--ios`, `--force`). |
| `maestrostack validate` | Validate config, suite structure, app and devices. |
| `maestrostack package` | Discover flows and build the suite zip (no upload). |
| `maestrostack upload-app` | Upload only the app; print its `app_url`. |
| `maestrostack upload-suite` | Package and upload only the suite; print its `test_suite_url`. |
| `maestrostack run` | Package, upload and trigger a build. |

### Global options

- `-c, --config <path>` - use a specific config file (e.g. `maestrostack.staging.yml`).
- `--debug` - verbose logging.

### `run` options

- `--dry-run` - validate, show the files that would be zipped and the exact
  BrowserStack payload + endpoint, without making any API calls.
- `--device <name>` - override `run.devices` (repeatable).
- `--execute <path>` - override `run.execute` (repeatable; forces explicit mode).

```bash
maestrostack run -c maestrostack.android.smoke.yml
maestrostack run --device "Google Pixel 7-13.0" --device "Samsung Galaxy S20-10.0"
maestrostack run --execute smoke/login.yml --dry-run
```

## How it works

`maestrostack run`:

1. Loads `.env` and the config, substitutes `${VAR}` tokens, validates everything.
2. Discovers flow files (ignoring root-level YAML, `node_modules`, `.git`).
3. Zips the suite under a `Flows/` prefix preserving folder structure.
4. Resolves the app (uploads the local binary or uses an existing `bs://` URL).
5. Uploads the suite zip.
6. POSTs the build to `.../maestro/v2/{android|ios}/build` and prints the build id.

Example output:

```text
MaestroStack run started

Project: Maestro_Test
Platform: android
Devices:
- Samsung Galaxy S20-10.0
- Google Pixel 7-13.0

App: bs://...
Test suite: bs://...
Build ID: 5c5ab4338cec13aeb78f7a6977344556ac00bccd6
```

## Development

```bash
npm install
npm run build       # bundle with tsup -> dist/cli.js
npm run typecheck   # tsc --noEmit
npm test            # vitest
```

The BrowserStack integration is covered by tests with mocked HTTP, so the full
package to payload path runs without a live account.

## License

MIT
