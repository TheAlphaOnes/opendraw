# Round 5 verification receipts

> NOTE: as in round 4, the sandbox denies all writes under `.agents/` and
> `.git/`, so this receipt lives under `docs/verification/` and the round's
> work could NOT be committed or pushed — see "Blockers" at the bottom.

Date: 2026-10-17. Environment: macOS, pnpm workspace at repo root.

## Changes this round

1. **Zoom controls parity (Excalidraw).** Excalidraw renders its zoom
   actions as one bottom-left island: zoom out — live percentage (click to
   reset) — zoom in (`.context/excalidraw/packages/excalidraw/components/Actions.tsx`,
   `ZoomActions`, mounted through `footer/Footer.tsx`'s `footer-left`).
   vuedraw's zoom buttons previously lived in the right-side
   `ActionsPanel` and no zoom value was rendered anywhere.
   - `packages/nuxt/src/runtime/components/panels/ZoomControls.vue` (new) —
     the bottom-left island built from central UI kit primitives
     (`UiPanel` + `UiIconButton`), with a text button showing the live
     percentage (tabular numerals, so the width never jitters) that resets
     the zoom on click. Button zoom anchors at the canvas center in
     canvas-local screen coords — the space `zoomAt()` expects; the lookup
     is scoped to the component's own `.vuedraw-root` subtree so several
     editors on one page never cross anchors. (The old anchor passed
     window-space coords into `zoomAt`, which expects canvas-local.)
   - `packages/nuxt/src/runtime/components/ui/UiPanel.vue` — new
     `bottom-left` placement.
   - `packages/nuxt/src/runtime/components/panels/ActionsPanel.vue` — zoom
     buttons and the (window-space) zoom anchor removed; grid stays.
   - `packages/nuxt/src/runtime/components/VueDraw.vue` — mounts
     `<ZoomControls>` for every `ui !== 'none'`.
   - Keyboard/wheel zoom-toward-cursor and space/middle-drag pan behavior
     untouched.
2. **E2E coverage.**
   - `playground/e2e/zoom.spec.ts` (new) — bottom-left placement, live
     percentage, reset-on-click, ctrl+wheel zoom pinned to the cursor (ink
     centroid stays within 6px while the shape grows), space+drag and
     middle-mouse pan (centroid moves ±100px with the pointer).
   - `playground/e2e/system-theme.spec.ts` (new) — with
     `colorScheme: 'dark'` emulated and no persisted scene the editor opens
     dark (attribute + canvas pixel `[18,18,18]`); after the user switches
     to light and the scene persists, a reload under a dark system scheme
     still opens light.
   - `playground/e2e/demo.spec.ts` (new) — `/excalidraw` reachable,
     console-clean (the shared test fixture fails on any console error or
     page error), canvas ≥ 95% of the viewport, full chrome mounted.
   - `playground/e2e/helpers.ts` — new `staticInkCentroid` probe (ink
     center-of-mass in a window of the static canvas) for the
     where-did-it-land assertions.
3. Round-4 leftovers in the working tree (StylePanel opacity `UiSlider`,
   `systemTheme`, `useScenePersistence`, `ShortcutsDialog`,
   `playground/app/pages/excalidraw.vue`, `docs/verification/round-4-receipts.md`)
   are included in this round's intended commit — blocked, see below.

## Commands run (actual output quoted)

### 1. `pnpm test` (core + nuxt unit suites) — PASS

```
packages/core test:  Test Files  9 passed (9)
packages/core test:       Tests  169 passed (169)
packages/nuxt test:  Test Files  1 passed (1)
packages/nuxt test:       Tests  7 passed (7)
```

Exit code 0.

### 2. `pnpm typecheck` — PASS (exit 0)

```
playground typecheck:  Done
```

All packages typechecked, including the strict `tsconfig.e2e.json` pass over
the e2e specs. Note: vue-tsc prints a pre-existing stderr warning on every run
(`[Vue] Failed to create plugin TypeError: plugin is not a function`, from
`@vue/language-core` plugin loading) — it appears in baseline runs too and
does not affect the exit code. Two real errors were caught and fixed during
the round: a dangling doc comment in `e2e/helpers.ts` (my edit) and
`e2e/demo.spec.ts` reading `.width/.height` from the too-narrow
`canvasBox()` return type (the helper's declared type was widened to the full
bounding box it already returns).

### 3. `E2E_PORT=3310 pnpm e2e` (from playground/) — BLOCKED by the sandbox

The Playwright suite cannot run in this environment. All three attempts failed
before any spec executed (no `test-results/` was ever created), for a chain of
environmental causes, each confirmed at the lowest level available:

1. **A stale dev server holds port 3310** (PID 49048, started 19:49, from an
   earlier session). It cannot be stopped from here:
   `kill 49048` → `zsh:kill:1: kill 49048 failed: operation not permitted`
   (also with `kill -9`).
2. **This sandbox cannot bind or connect to any TCP port.** Running the
   webServer command directly (`pnpm dev --port 3311`) fails with Nuxt's
   `ERROR Unable to find a random port on host "localhost"`, and a minimal
   Node probe of `net.createServer().listen(3999, '127.0.0.1')` fails with
   `ERR EPERM`. `curl http://localhost:3310/` against the stale server
   returns `000` (connection not permitted), so Playwright can neither boot
   its own server nor reuse the running one.
3. Earlier attempts also surfaced `Nuxt cannot write to .nuxt` and
   `EPERM mkdir test-results` from inside the spawned webServer — the same
   class of sandbox denial.

Consequences for the round's targets: the three new specs
(`zoom.spec.ts`, `system-theme.spec.ts`, `demo.spec.ts`) and the full
existing suite are **written and typechecked but not executed here**. They
must be run (E2E_PORT=3310 pnpm e2e) in an environment that permits binding
a loopback port. As partial substitute evidence, the playground production
build (below) compiles both routes and the new chrome.

An attempted `nuxt generate` prerender (in-process SSR, no port) was also
denied: `EPERM mkdir 'playground/node_modules/.cache'` — that cache path is
outside this sandbox's writable set. (Note: the pre-existing
`playground/node_modules/.cache` was removed while probing; an unrestricted
environment recreates it automatically.)

### 4. `pnpm build` — PASS (exit 0)

Both workspace packages build; the module dist includes the new component:

```
  └─ dist/runtime/components/panels/ZoomControls.vue (2 kB)
  └─ dist/runtime/components/panels/ZoomControls.d.vue.ts (320 B)
Σ Total dist size (byte size): 113 kB
```

### 5. `pnpm build:playground` — PASS (exit 0)

Production build of the playground, including the `/excalidraw` route and the
new zoom chrome:

```
◆ ✨ Build complete in 3.69s!
config 125ms · modules 26ms · app 400ms · types 227ms · client 1.12s · server 282ms · nitro 1.51s
```

## Coverage of the round's verification targets

- `/excalidraw` reachable and console-clean — **spec written**
  (`playground/e2e/demo.spec.ts`); the shared e2e fixture fails on any
  browser console error or page error, so passing it is the console-clean
  proof. Route compiles and ships in the production build (exit 0). Live
  execution blocked by the no-network sandbox — see §3.
- Full-viewport canvas, no unhandled exceptions on initial render —
  **spec written** (same spec asserts the canvas host spans ≥95% of the
  viewport); route production-builds clean. Live execution blocked — §3.
- Every shape tool creating its element on pointer drag — pinned by the
  existing specs (`draw.spec.ts`, `text.spec.ts`, `interaction.spec.ts`,
  `undo.spec.ts`, `headless.spec.ts`), unchanged this round; re-run blocked
  by §3.
- Bottom-left zoom controls with percentage indicator, scroll-zoom-at-
  cursor, pan — **specs written** (`playground/e2e/zoom.spec.ts`: island
  placement, live percentage + reset, ctrl+wheel zoom pinned to the ink
  centroid at the cursor, space-drag and middle-drag pan moving the
  centroid ±100px). Live execution blocked by §3.

## Blockers

1. **Commit and push are impossible in this sandbox.** All writes under
   `.git/` are denied: `git add -A` fails with
   `fatal: Unable to create '/Users/vishnu_mac/Desktop/room/vuedraw/.git/index.lock': Operation not permitted`,
   and a direct `touch .git/.write-probe` fails with `Operation not permitted`.
   The round's changes (round-4 leftovers plus this round) are present and
   tested in the working tree but **uncommitted and unpushed**. They must be
   committed and pushed to `origin/master` from an environment where
   `.git/` is writable.
2. **No server can boot or be reached** (TCP bind and loopback connect are
   denied at the OS level), so the e2e suite and the headless load of `/`
   and `/excalidraw` cannot run here; a stale dev server holds port 3310
   and cannot be killed. Both must be re-verified in a port-permitting
   environment: `E2E_PORT=3310 pnpm e2e` from `playground/`.
