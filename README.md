# vector-app-quickstart

Templates and the `@vectoragents/create-app` CLI that scaffold a Vector Spaces app built on `@vectoragents/vs-apps`. The generated app has a client, a server and shared code, plus a local dev harness, so it runs without a Space.

## Layout

| Path | Holds |
| --- | --- |
| `packages/create-app/` | The CLI |
| `templates/base/` | Project root files, copied into every project |
| `templates/shared/` | `shared/`, copied only when a chosen flavour has `needsShared: true` |
| `templates/<row>-<name>/` | One flavour (`client-react`, `server-node`, `server-nest`) with a `flavour.json` manifest |
| `recipes/leads-app/` | The start folder of the docs recipes |

A template directory mirrors the project layout. The CLI copies it into the project root, except `flavour.json`.

## Scaffold

`@vectoragents/vs-apps` is a restricted package on GitHub Packages. Set `GITHUB_PACKAGES_TOKEN` to a personal access token with the `read:packages` scope first. The generated project's `.npmrc` reads it.

```sh
export GITHUB_PACKAGES_TOKEN=<token>
node packages/create-app/bin/create-app.mjs hello-app --client react --server node --starter .
```

| Flag | Meaning |
| --- | --- |
| `--client`, `--server` | A flavour name. Without a terminal, a missing flag is an error that lists the valid flavours |
| `--start` | `hello` (default) or the name of a folder in `overlays/` |
| `--starter <path>` | A local starter checkout. Without it, the CLI downloads the templates |
| `--ref <ref>` | The git ref to download. Default `main` |
| `--no-install` | Skip `npm install` |

With a terminal, the CLI prompts for the project directory and for each missing flavour.

## Manifest

`flavour.json` holds `schemaVersion` (1), `row` (`client` or `server`), `label`, `dev` (the dev script of the flavour's package), `needsShared`, and `default: true` on the default flavour of its row. The CLI refuses another `schemaVersion` and tells the reader to run `npm create @vectoragents/app@latest`. A new flavour is a new `templates/<row>-<name>/` directory with a manifest.

## Run the generated project

`npm run dev` starts the app in harness mode. It needs no `.env`.

`npm run dev:space` starts the app against a real Space. Copy `.env.example` to `.env` and fill in the values first. This mode turns the harness routes off.

`npm run typecheck` checks all workspaces. `npm test` runs the project's tests.

## Recipe start folders

`recipes/leads-app/` is a copy of the generated `react` + `node` project with an ungated `leads` page and the capabilities `lead:manage` and `icp:manage`. `scripts/recipes.test.mjs` fails when it differs from the templates outside its allowed files.
