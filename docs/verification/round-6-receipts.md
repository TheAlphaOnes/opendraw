# Round 6 verification receipts

> This was a **verification-only round**: my file scope for edits is
> `docs/verification/` only, so no production code was changed by me. This
> receipt documents the current working-tree state (the uncommitted round 4–6
> work) and the validation evidence I could gather inside this sandbox.
>
> As in rounds 4–5, the sandbox denies writes under `.git/`, so nothing here
> can be committed or pushed — see "Blockers".

Date: 2026-10-17. Environment: macOS, pnpm workspace at repo root.

## Working-tree state verified

`git status` shows 19 modified files plus 21 untracked paths, all uncommitted
(`git log` HEAD is still `4018725 pin outline-true docking with an e2e spec`).
Relative to the round-5 receipt, the tree now additionally contains:

- **Eraser tool** — core hit-testing changes
  (`packages/core/src/elements/hitTest.ts` + its tests) and
  `playground/e2e/eraser.spec.ts`.
- **Image tool** — `packages/nuxt/src/runtime/services/image.service.ts`,
  core image support (`packages/core/tests/image.test.ts`, png/serialize
  export paths), and `playground/e2e/image.spec.ts`.
- **SVG export** — `packages/core/src/export/svg.ts` (pure string building,
  no DOM, so it also runs under SSR/Node) with
  `packages/core/tests/export-svg.test.ts`, exported through
  `packages/core/src/index.ts`.
- **Scene persistence** — `packages/nuxt/src/runtime/persistence/persistedScene.ts`
  and `systemTheme.ts`, the `useScenePersistence` composable, with
  `packages/nuxt/tests/persistedScene.test.ts` and a
  `playground/e2e/persistence.spec.ts` (the nuxt package's first unit suite —
  `packages/nuxt/vitest.config.ts` is new).
- Carried over from rounds 4–5: `ZoomControls.vue`, `ShortcutsDialog.vue`,
  `UiSlider.vue`, `WelcomeScreen.vue`, `playground/app/pages/excalidraw.vue`,
  `playground/e2e/{demo,system-theme,toolbar,zoom}.spec.ts`, and the docs
  under `docs/verification/`.

## Commands run (actual output quoted)

### 1. `pnpm test` — BLOCKED as written, PASS via workaround

`pnpm test` fails at startup in both packages:

```
packages/core test: Error: EPERM: operation not permitted, open
  '.../packages/core/node_modules/.vite-temp/vitest.config.ts.timestamp-...mjs'
```

Vitest's default `bundle` config loader writes a temp file into
`node_modules/.vite-temp/`, which this sandbox denies. **Workaround found:**
Vite/Vitest support a `runner` config loader that needs no temp-file write, so
the suites were run as:

```
cd packages/core && ../../node_modules/.bin/vitest run --configLoader runner
cd packages/nuxt  && ../../node_modules/.bin/vitest run --configLoader runner
```

Results — **PASS** in both packages:

```
packages/core:  Test Files  11 passed (11)
                Tests       191 passed (191)
   incl. tests/export-svg.test.ts (8), tests/image.test.ts (10),
         tests/hitTest.test.ts (20)

packages/nuxt:   Test Files  1 passed (1)
                Tests        7 passed (7)
   tests/persistedScene.test.ts
```

191 core tests is up from 169 at round 5; the new eraser/image/SVG work is
covered. (Caveat for reproduction elsewhere: with the default `bundle` loader
the same suites pass as plain `pnpm test` — the workaround is only needed
under this write-restricted sandbox.)

### 2. `pnpm typecheck` — core and nuxt PASS; playground step needs substitution

```
packages/core typecheck:  Done
packages/nuxt typecheck:  Done
```

The playground step fails **before vue-tsc runs**, at its `nuxt prepare`
preflight:

```
playground typecheck: ERROR EPERM: operation not permitted, open
  '.../playground/.nuxt/manifest/meta/7bfb10eb-....json'
```

`nuxt prepare` writes under `playground/.nuxt/`, outside this sandbox's
writable set. **Substitute evidence:** a `.nuxt` prepared earlier today
(22:01) already exists, so both vue-tsc passes were run directly against it,
skipping the prepare step:

```
cd playground && pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.json   → PASS-app
               && pnpm exec vue-tsc --noEmit -p tsconfig.e2e.json     → PASS-e2e
```

Both pass (exit 0). The known pre-existing vue-tsc plugin warning
(`[Vue] Failed to create plugin TypeError: plugin is not a function`) appears
on stderr as in every prior run and does not affect the exit code. Caveat: the
`.nuxt` snapshot was prepared before this verification, so a fresh
`pnpm typecheck` in an unrestricted environment remains the authoritative
playground check.

### 3. `E2E_PORT=3310 pnpm e2e` — not attempted, still blocked

The Playwright suite cannot run here: this sandbox denies TCP bind and
loopback connect at the OS level (proven in the round-5 receipt, §3, with a
`net.createServer().listen()` EPERM probe), and a stale dev server still
holds port 3310 unkillable from here. Nothing has changed that would lift
that, so the e2e specs — including the new `eraser.spec.ts`,
`image.spec.ts`, `persistence.spec.ts`, and `toolbar.spec.ts` — remain
**written and typechecked but not executed in this environment**. They must be
run with `E2E_PORT=3310 pnpm e2e` from `playground/` in a port-permitting
environment.

### 4. `pnpm build` — not attempted

Both package builds write to `packages/*/dist`, which is outside this round's
writable set; a run would fail on EPERM for the dist writes, not on anything
real. Round 5's receipt records a clean `pnpm build` and
`pnpm build:playground` for the pre-eraser/image/SVG state; the additions
since then are typechecked and unit-tested above, but a fresh production
build has **not** been re-witnessed this round and should be re-run in an
unrestricted environment.

## Coverage of the mission objective (Excalidraw parity of the demo)

- Demo route `/excalidraw` with the full Excalidraw chrome (tool dock in
  Excalidraw order, style panel, zoom island, welcome screen, shortcuts
  dialog) — components present and typechecked; behavior pinned by
  `demo.spec.ts` / `toolbar.spec.ts`; **live e2e execution blocked** (§3).
- Eraser, image tool, SVG export, scene persistence + system theme — unit
  tests all pass (§1); browser-level specs written but not executed (§3).
- Mission-level verdict: the code and tests are in place and everything
  runnable in this sandbox is green, but the *browser-verified* parity claim
  still rests on an environment that can bind a port and on a commit that
  cannot be made from here.

## Blockers

1. **Commit/push still impossible** — all writes under `.git/` are denied, as
   in rounds 4–5. The accumulated rounds 4–6 changes (40 paths) are present
   and tested in the working tree but uncommitted and unpushed.
2. **E2e and live demo load still impossible** — no TCP bind/connect, stale
   server on 3310 (round-5 receipt §3). The new specs must be executed and
   the demo visually re-verified in a port-permitting environment.
3. **Sandbox-write denials shaped the evidence** this round: `pnpm test` needed
   the `--configLoader runner` workaround, and the playground typecheck
   needed a direct vue-tsc run against the pre-existing `.nuxt`. Both are
   documented above so the next environment knows exactly which command to
   re-run in full (`pnpm test`, `pnpm typecheck`, `pnpm build`,
   `E2E_PORT=3310 pnpm e2e`).
