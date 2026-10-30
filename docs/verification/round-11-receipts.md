# Round 11 verification receipts

> This is a **receipts-only round**: my file scope for edits is
> `docs/verification/round-11-receipts.md` and nothing else, so no production
> code, spec, or page was changed by me. A previous attempt reported this
> receipt but the file was never written, this file is that missing record.
> The format follows rounds 4–6. (Note for the reader: only rounds 4–6 exist
> under `docs/verification/`; no round 7–10 receipt files are present in the
> tree, so those rounds' claims could not be cross-read from disk.)

Date: 2026-10-17. Environment: macOS, pnpm workspace at repo root, sandboxed
(write-restricted) execution.

## Provenance of the live e2e result, read this first

**The Playwright suite was executed by the user on their own machine, not in
this sandbox.** This sandbox cannot bind a TCP port or drive a browser (the
same environment denials proven in the round-5 receipt, §3: Nuxt
`Unable to find a random port`, a raw `net.createServer().listen()` probe →
EPERM). What is recorded here:

- **Command (per the user's report):** `E2E_PORT=3310 pnpm e2e`, run from
  `playground/` on the user's machine.
- **Date:** 2026-10-17.
- **Result:** the user reports **all specs passed**.

I did not see that run's raw output; no command output from the user's machine
is pasted or paraphrased below as if it were my own. The user's report is the
provenance of the *passing* verdict; the specs themselves, titles and
assertions quoted below, read from the working tree in this session, are the
executable proof of *what* was verified. Everything runnable inside this
sandbox was re-run by me today and its real output is quoted in the next
section, so the tree being certified is the same tree the user ran against.

## Commands run locally (actual output quoted)

### 1. Unit suites (`pnpm test` equivalent), PASS

Plain `pnpm test` cannot run here: vitest's default `bundle` config loader
writes a temp file into `node_modules/.vite-temp/`, which this sandbox denies
(same denial as round 6, §1). The suites were run with the documented
workaround (runner loader, no temp-file write):

```
cd packages/core && ../../node_modules/.bin/vitest run --configLoader runner

 Test Files  11 passed (11)
      Tests  191 passed (191)
   Duration  251ms
```

```
cd packages/nuxt && ../../node_modules/.bin/vitest run --configLoader runner

 ✓ tests/persistedScene.test.ts (7 tests) 4ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
   Duration  162ms
```

Both exit 0. Caveat: outside this write-restricted sandbox the same suites
pass as plain `pnpm test`; the workaround is only needed here.

### 2. `pnpm typecheck`: core and nuxt PASS; playground needs substitution

```
packages/core typecheck$ tsc --noEmit -p tsconfig.json
packages/core typecheck: Done
packages/nuxt typecheck$ vue-tsc --noEmit
packages/nuxt typecheck: Done
```

The playground step fails **before vue-tsc runs**, at its `nuxt prepare`
preflight, on a sandbox write denial:

```
playground typecheck:  ERROR  EPERM: operation not permitted, open
  '.../playground/.nuxt/manifest/meta/efbf26b9-....json'
```

Substitute evidence (as in round 6): a `.nuxt` snapshot prepared today
(22:01, same day as this verification) already exists, so both vue-tsc passes
were run directly against it, skipping the denied prepare step:

```
cd playground && pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.json   → exit 0
               && pnpm exec vue-tsc --noEmit -p tsconfig.e2e.json     → exit 0
```

The pre-existing vue-tsc plugin warning
(`[Vue] Failed to create plugin TypeError: plugin is not a function`) prints to
stderr on every run, including baselines, and does not affect either exit
code. Caveat: the `.nuxt` snapshot predates this verification run, so a fresh
`pnpm typecheck` in an unrestricted environment remains the authoritative
playground check.

### 3. `pnpm build`: BLOCKED by the sandbox; compile+emit proven via redirect

`pnpm build` fails on dist-write denials, not on any compile error, every
failure is an `EPERM` write into `packages/core/dist/`:

```
error TS5033: Could not write file '.../packages/core/dist/viewport.js':
EPERM: operation not permitted, open '.../packages/core/dist/viewport.js'.
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @vuedraw/core@0.1.0 build: `tsc -p tsconfig.build.json`
```

Substitute evidence: the exact same build program (`tsc -p
tsconfig.build.json`, the package's own build script) with only the output
directory redirected into this sandbox's writable temp area **compiles and
emits cleanly, exit 0**:

```
cd packages/core && ../../node_modules/.bin/tsc -p tsconfig.build.json \
  --outDir /tmp/vuedraw-core-dist        → exit 0
```

The nuxt module's `nuxt-module-build build` step also writes to
`packages/nuxt/dist/` and was therefore **not re-witnessed this round**; the
authoritative prior witness is the round-5 receipt (§4, clean `pnpm build`
exit 0 for the then-current tree), and everything added since is covered by
today's `vue-tsc --noEmit` pass over the same package (exit 0 above) plus the
unit suites. A fresh `pnpm build` in an unrestricted environment remains the
outstanding item.

### 4. `E2E_PORT=3310 pnpm e2e`: executed by the user, not here

As stated in the provenance section: the user ran this command from
`playground/` on their machine on 2026-10-17 and reports all specs passed.
It was not run and could not be run from this sandbox (round-5 §3 denial
chain is unchanged: no TCP bind, no loopback connect).

## Criterion mapping

Each criterion below names the spec file, the exact test title from the tree,
and the key assertions that pin it, quoted from the spec source. Where the
coverage is narrower than the criterion's full wording, the gap is stated
explicitly rather than papered over.

### G1-C2, demo route reachable, console-clean

`playground/e2e/demo.spec.ts`, test
**"the /excalidraw demo renders a console-clean full-viewport canvas"**:

- `await openApp(page, '/excalidraw')`: the route loads at `/excalidraw`.
- Console-clean is structural: every spec runs through the shared fixture in
  `playground/e2e/helpers.ts` (`page` override), which collects
  `page.on('pageerror')` and console `error` messages and asserts
  `expect(errors, 'browser console must stay clean').toEqual([])` at
  teardown, so a passing run is itself the no-console-errors proof.

Route source: `playground/app/pages/excalidraw.vue` (created in round 4,
per the round-4 receipt).

### G1-C3, full-viewport canvas, no exceptions on initial render

Same test in `demo.spec.ts`:

- `const box = await canvasBox(page)` then
  `expect(box.width).toBeGreaterThan(view!.width * 0.95)` and
  `expect(box.height).toBeGreaterThan(view!.height * 0.95)`: the canvas host
  spans at least 95% of the viewport in both dimensions.
- No unhandled exceptions during initial render is pinned by the same shared
  console/page-error fixture described above, plus
  `await settleFrames(page)` before the geometry assertions so the first
  render frames are included.

### G2-C2, each shape tool creates its element on pointer drag

Covered by real per-tool drag specs, with two honest gaps:

- **Rectangle**: `draw.spec.ts`, **"draws a rectangle that lands in the
  document selected"**: `pickTool(page, 'Rectangle (2)')`, drag
  `(220,140) → (380,240)`, then
  `expect(drawn.type).toBe('rectangle')`,
  `expect((await scene(page)).selection).toEqual([drawn.id])`, and the Undo
  button is enabled.
- **Arrow**: `draw.spec.ts`, **"binds an arrow dropped over a shape and
  follows it"**: arrow drawn on drag, element count reaches 2, and the bound
  tip follows the shape on move (`tipOf(...).x` grows past
  `looseStart.x + 300`).
- **Line**: `draw.spec.ts`, **"binds a line dropped over a shape exactly
  like an arrow"**: same gesture via `pickTool(page, 'Line (6)')`, pinned to
  the same binding/docking assertions; also **"frames a line drawn up-left
  around its true bounds"** (`expect(line.points![1]).toEqual({ x: -120,
  y: -100 })`).
- **Diamond**: `interaction.spec.ts`, **"docks a diagonal arrow on the
  diamond's own edge, not its bounds box"**: a diamond is drawn on drag
  (`pickTool(page, 'Diamond (3)')` → `(await scene(page)).elements[0]!`
  becomes the docking target `diamondId`), so diamond-on-drag creation is exercised even
  though that spec's focus is arrow docking.
- **Text (click-to-place)**: `text.spec.ts`, **"creates a text element
  through the wysiwyg editor"**: `pickTool(page, 'Text (T)')`, a single
  click at `(300,200)`, then
  `await expect(editor).toBeVisible()` / `toBeFocused()` for the
  `'Text editor'` textbox, `page.keyboard.type('hello vuedraw')`, `Escape`
  commits with `expect(text.type).toBe('text')` and
  `expect(text.text).toBe('hello vuedraw')`.
- **Gap 1, Ellipse:** no e2e spec drags the `Ellipse (4)` tool. Its presence
  in the dock is pinned (`toolbar.spec.ts`, tools listed in Excalidraw order
  including `'Ellipse (4)'`), and the ellipse element type is exercised at the
  core unit level (`tests/hitTest.test.ts`, `tests/render.test.ts`,
  `tests/elements.test.ts`), but e2e drag-creation of an ellipse is
  unasserted.
- **Gap 2, Freedraw:** no e2e spec performs a freedraw pointer-move path
  drag (`Freedraw (P)` appears only in `toolbar.spec.ts`'s dock listing).
  Core-side path handling has unit coverage (`tests/render.test.ts`,
  `tests/hitTest.test.ts` reference freedraw elements), but e2e
  pointer-move path capture for freedraw is unasserted.

### G4-C1, zoom toward cursor, pan, bottom-left zoom controls

`playground/e2e/zoom.spec.ts`, four tests:

- **"zoom controls live in the bottom-left corner and report 100%
  initially"**: `.zoom-controls` visible with `Zoom out` / `Zoom in` buttons
  and the readout at `100%`; placement pinned by
  `expect(box!.x).toBeLessThan(160)` and
  `expect(box!.y).toBeGreaterThan(view!.height - 160)` (Excalidraw's
  bottom-left island).
- **"the percentage readout tracks button zoom and resets on click"**:
  `100% → 125% → 156%` on zoom-in clicks, back to `125%`, and clicking the
  readout (role button, name `/reset zoom/i`) returns `100%`.
- **"ctrl+wheel zooms toward the cursor"**: a filled rectangle is drawn,
  then ctrl+wheel at its center; the readout goes to `125%`, the shape grows
  (`after.count > before.count * 1.4`) while its ink centroid stays pinned
  to the cursor within 6px in both axes.
- **"space+drag and middle-mouse drag pan the canvas"**: space-drag moves
  the ink centroid by exactly `(+100, 0)` (`toBeCloseTo(before!.x + 100, 1)`),
  and a middle-button drag pans it back (`toBeCloseTo(before!.x, 1)`).
- **Gap, pinch zoom:** no spec asserts trackpad pinch-zoom; Playwright's
  mouse API cannot emulate a two-finger pinch gesture, and none was
  attempted. Wheel-zoom toward the cursor and both pan modes are pinned;
  pinch is not.

### G6-C2, dark default from system scheme, persisted override, working toggle

`playground/e2e/system-theme.spec.ts`, describe block
**"system dark color scheme"** with `test.use({ colorScheme: 'dark' })`:

- **"opens in the dark theme with no persisted scene"**: with a dark system
  scheme and no persisted scene,
  `await expect(page.locator('.vuedraw-root')).toHaveAttribute('data-theme', 'dark')`
  and the canvas pixel check `expect(await pixelAt(page, 6, 6)).toEqual([18, 18, 18])`.
- **"a persisted light theme still wins over the system default"**: the
  user clicks `getByRole('button', { name: 'Light theme' })`, the root
  flips to `data-theme="light"`, the save is allowed to land (600ms wait for
  the 300ms-debounced persist), and after `page.reload()` the editor still
  opens light under the same dark system scheme.
- The toggle's dark direction and dark-theme ink are additionally pinned by
  `theme.spec.ts` (**"switches the scene to dark and back"** and **"the
  wysiwyg editor types in the dark theme ink"**).

### G8-C2, text editing (double-click, tool click, click-to-edit)

- **Text-tool click-to-place** is fully pinned by `text.spec.ts`
  (**"creates a text element through the wysiwyg editor"**, quoted under
  G2-C2), including that the editor mounts focused and commits on Escape.
  **"renders text once: the canvas stays blank while the editor is open"**
  additionally pins the single-render invariant: while the session is open
  the static canvas holds no ink in the window (`during <= 4` pixels) and
  after commit `after > during + 40`.
- **Gap, double-click and click-to-edit existing text:** no e2e spec
  performs a double-click on existing text, and none clicks existing text to
  re-edit it in place (a grep for `dblclick` across `playground/e2e/*.spec.ts`
  returns nothing). The criterion's double-click-to-edit and
  click-existing-text-to-edit clauses are therefore **not pinned by the
  suite**; only creation via the text tool is.

### G8-C3, marquee drag from an empty point selects intersecting elements

The task brief pointed at `interaction.spec.ts`, but the marquee assertions
actually live in `draw.spec.ts` (citing what is in the tree, not the brief):

- **"narrows a multi-selection with a plain click on one shape"** draws two
  rectangles, then with the Selection tool drags a marquee from `(200,120)`
  to `(440,240)` over both:
  `await expect.poll(async () => (await scene(page)).selection.length).toBe(2)`,
  a drag from an empty point selecting both intersecting elements, and a
  plain click then narrows `selection` to `[secondId]`.
- **"clears the marquee chrome when the drag ends empty"** pins that a
  marquee drag over empty canvas leaves no selection chrome
  (`nonTransparentPixels(...overlay)` is `0`).

## Summary of gaps recorded honestly

1. The passing e2e verdict is the **user's report** from their machine
   (2026-10-17, `E2E_PORT=3310 pnpm e2e` from `playground/`); this sandbox
   re-verified the tree's unit tests, typecheck (core, nuxt, and both
   playground vue-tsc passes against the existing `.nuxt`), and the core
   build compile+emit, all green, but could not execute the browser suite.
2. E2e drag-creation specs do not exist for the **ellipse** and **freedraw**
   tools (dock presence and core unit coverage only).
3. **Pinch-zoom** has no spec (not emulatable with Playwright's mouse API).
4. **Double-click-to-edit** and **click-existing-text-to-edit** have no spec;
   only text-tool click-to-place is pinned.
5. `pnpm build` for the nuxt package and a fresh playground `pnpm typecheck`
   could not be re-witnessed here (dist and `.nuxt` writes are denied); core
   compile+emit is proven via the redirected-output build above.

## Blockers (unchanged from rounds 4–6)

1. No TCP bind or loopback connect in this sandbox → no e2e, no dev server;
   the suite must keep being run outside (the user did so today).
2. `.git/` writes are denied → nothing can be committed or pushed from
   here; per the task's instructions no commit/push was attempted.
3. This round's file scope was a single new file, so the gaps above could
   not be closed by writing new specs here; they are recorded so a later
   round can dispatch them as work.
