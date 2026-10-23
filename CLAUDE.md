# CLPS DAW

Hobby 8-bit DAW for phones, tablets and desktop browsers: a client-only React SPA on the plain Web
Audio API, installable as a PWA from GitHub Pages.

## Design

`docs/DESIGN.md` is the source of truth for decisions, the JSON song format, the audio graph,
gestures, iOS quirks and the build phases. Read it before changing behaviour, the song format, or
anything that touches audio, files or storage. When a decision changes, update it there in the same
commit as the code.

## Workflow

- Work one phase at a time (DESIGN.md → Phases). A phase is done when it is deployed and the user
  has tested its milestone on its devices; end the phase by handing over that milestone.
- `pnpm check` is the CI gate; run it green before every commit.
- Commit straight to `main`, with the message prefixed `[main] ` (a global commit-msg hook
  enforces it). Every push to `main` deploys.

## Code

- Layers: `src/model` (plain data, Zod schemas, pure functions) ← `src/audio` (engine singleton
  outside React) ← `src/app` and `src/ui` (React, Zustand). The model stays free of React and Web
  Audio so Vitest covers it in Node.
- Tests cover the UI-free core and sit next to the code as `*.test.ts`.
- Styling: CSS Modules plus the PICO-8 variables in `src/styles/global.css`.
- UI text is English and uppercase.

## Gotchas

- TypeScript is pinned to 6.0 because typescript-eslint does not support 7.x yet.
- The app is served under `/clps-daw/` (Vite `base`), also in dev.
- `pnpm dev --host` on the LAN is an insecure context: no service worker, Web Share or
  `crypto.randomUUID`. Test install, audio session and file export on the deployed URL.
- Icons come from `pnpm icons` and are committed.
- pnpm 11 holds back very recent releases (`minimumReleaseAge`); `pnpm-workspace.yaml` lists the
  exceptions.
