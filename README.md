# vector-app-quickstart

Starter for a Vector Spaces app: a "Hello" app with a React client, a Node server and a shared app definition, built on `@vectoragents/vs-apps`. It includes a local dev harness, so the app runs without a Space.

## Install

`@vectoragents/vs-apps` is a restricted package on GitHub Packages. Set `GITHUB_PACKAGES_TOKEN` to a personal access token with the `read:packages` scope, then install. `.npmrc` reads the token from the environment.

```sh
export GITHUB_PACKAGES_TOKEN=<token>
npm install
```

## Run

`npm run dev` starts the app in harness mode. It needs no `.env`.

`npm run dev:space` starts the app against a real Space. Copy `.env.example` to `.env` and fill in the values first. This mode turns the harness routes off.

`npm run typecheck` checks all workspaces.

## Recipe start folders

`recipes/leads-app/` is a copy of this starter with an ungated `leads` page and the capabilities `lead:manage` and `icp:manage`. The docs recipes start from it. It is its own project: run `npm install`, `npm run dev` and `npm run typecheck` inside it. Its SDK pin follows the root pin.
