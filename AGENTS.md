# AGENTS.md

This file provides guidance to the AI agent when working with code in this repository.

## What This Repo Is

This is the `xbb` (销帮帮 CRM) plugin for `opencli`. Every top-level `*.js` file registers one `opencli xbb <command>` via `opencli-registry.js`. There is no build step, no linter, and no test framework.

## Setup

```bash
npm install -g @jackwener/opencli
opencli plugin install github:chenhb1988/opencli-plugin-xbb
opencli xbb set-token --corpid <CORPID> --token <TOKEN>
```

Credentials are stored in `~/.opencli/xbb/config.json`. `set-token` also writes a formlist cache to `~/.opencli/xbb/<corpid>.formlist.json`.

After editing, sync files to the live plugin directory:

```bash
xcopy /e D:\github\opencli-plugin-xbb\*.js C:\Users\chb\.opencli\plugins\opencli-plugin-xbb\
```

## Verification (No Automated Tests)

After changing a command, run one minimal real call against the actual API:

```bash
opencli xbb userlist --corpid <CORPID> --limit 1
opencli xbb formlist --corpid <CORPID> --saasMark 1
```

Add `--debug` to see the serialized request body and raw response.

## Code Style Rules

- **ESM only** — `"type": "module"` in `package.json`; always use `import`/`export`.
- **Node built-ins use `node:` prefix** — `node:fs`, `node:path`, `node:crypto`, etc.
- **All commands import from `./opencli-registry.js`**, never directly from `@jackwener/opencli`.
- **No shared utility modules** — duplicate code across files rather than introducing shared abstractions, unless the same change is needed in multiple files for the same reason.

## Command Module Pattern

Every command file follows this structure (see `userlist.js`, `customerlist.js` as canonical examples):

1. Hardcoded API URL constant + config path (`~/.opencli/xbb/config.json`)
2. `readConfig()` — parse config file, return `{}` on failure
3. `getRuntimeConfig(kwargs)` — merge CLI args with config file
4. `buildPayload(kwargs)` — omit `undefined` fields; never send them
5. `getValidationError(payload, token)` — return `{code, msg}` or `null`
6. `makeErrorRow(...)` / `makeSuccessRows(...)` — return object arrays (never throw)
7. `cli({...})` — register with `site: 'xbb'`, `strategy: Strategy.PUBLIC`, `browser: false`
8. HTTP: `POST`, `Content-Type: application/json;charset=UTF-8`, sign header = `SHA256(JSON.stringify(body) + token)`

## Critical Constraints

- **Errors return a synthetic row** (`[{code, msg}]`), never thrown exceptions.
- **`--limit` is applied after response mapping** — changing field mapping affects truncated output.
- **Optional numeric fields**: use `String(kwargs.field ?? '') !== ''` to distinguish "not provided" from "provided as 0". Many xbb API endpoints treat these differently.
- **`--attr`/`--value` conditions**: only added to the request body when *both* are present.
- **corpid mismatch**: most commands validate CLI `--corpid` against `config.json`; mismatch returns `CORPID_MISMATCH` error row.
- **Base URL routing**: Dingtalk corpids (starts with `ding` or contains `$$ding`) → `https://proapi.xbongbong.com`; others → `https://appapi.xbongbong.com`. Most commands derive the final URL from the saved `baseurl` + their own pathname.
- **`columns` output contract is stable** — changing request body fields is safer than renaming output columns.
- **Command filenames are stable** — each `*.js` maps to a live CLI entry point; do not rename files.

## Workflow: formId-Dependent Commands

`formlist` → `formget` → data commands (`customeradd`, `formdataadd`, etc.) is the standard dependency chain. `dataList` is passed as a JSON string and parsed inside the command.
