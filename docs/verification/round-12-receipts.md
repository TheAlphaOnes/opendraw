# Round 12 verification receipts

Date: 2026-10-17. Environment: macOS, pnpm workspace at repo root, sandboxed
(write-restricted) execution. The task brief said the e2e tsconfig lives at
`playground/e2e/tsconfig.e2e.json`; it actually lives at
`playground/tsconfig.e2e.json` (citing the tree, not the brief).

Scope of this round: write the missing e2e specs (ellipse, freedraw,
double-click-to-edit, click-existing-text-to-edit, trackpad pinch), implement
what they revealed to be missing, and re-confirm the round-11 mapping for
G6-C2/G8-C3. All work stayed inside the repo; no commit/push was attempted
(`.git/` writes are denied by the sandbox, and the user commits themselves).

## Implemented versus found already present

### Found already present (no change needed)

- **Double-click a text element → wysiwyg editor reopens with existing
  content.** `onDoubleClick` in
  `packages/nuxt/src/runtime/components/VueDrawCanvas.vue` (selection tool,
  hit-test, `beginStep` + `setEditing(hit.id)`) and `TextEditor.vue`'s
  `onMounted` (`ta.value = el.text`, caret at end) already implement the
  Excalidraw semantics. What was missing was only the **spec**: a grep for
  `dblclick` across `playground/e2e/*.spec.ts` returned nothing before this
  round.
- **Pinch-zoom handler.** `onWheel` already branches on
  `event.ctrlKey || event.metaKey` and zooms toward the cursor; the browser
  surfaces a trackpad pinch as exactly this event. Only the dedicated spec was
  missing.

### Implemented this round (the gap the specs revealed)

**Text-tool click on existing text now edits it in place**,
`packages/nuxt/src/runtime/components/VueDrawCanvas.vue`, the `tool === 'text'`
branch of `onPointerDown` (previously it called `createTextAt(scenePoint)`
unconditionally, stacking a new element under the pointer). Reference:
`.context/excalidraw/packages/excalidraw/components/App.textTool.ts`,
`getTargetAt` resolves a `{ type: "text", element }` target *before* free
creation, and its `handlePointerDown` case `"text"` calls
`startTextEditing` on that element (line ~304). The vuedraw implementation
follows the existing architecture: hit-test via `findElementAt`, then
`ctx.doc.beginStep()` (the one open step the editor commits into),
`ctx.select(hit.id)`, `ctx.setActiveTool('selection')` (tool revert, matching
Excalidraw's `finish()`), `ctx.setEditing(hit.id)`: the same sequence shape
`createTextAt` uses, all mutations through the document. Typed, no swallowed
errors, no other tool paths touched.

## New specs (titles and key assertions quoted)

### G2-C2, `playground/e2e/draw.spec.ts`

**"draws an ellipse that lands in the document selected"**: mirrors the
rectangle case:

```ts
await pickTool(page, 'Ellipse (4)')
await drag(page, at(box, 220, 140), at(box, 380, 240))
await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
const drawn = (await scene(page)).elements[0]!
expect(drawn.type).toBe('ellipse')
expect((await scene(page)).selection).toEqual([drawn.id])
await expect(page.getByRole('button', { name: 'Undo (Ctrl+Z)' })).toBeEnabled()
```

**"captures a freedraw stroke as a pointer-move pressure path"**: pins the
freedraw tool via the pointer-move path capture, read through the
`window.__vuedraw` mirror:

```ts
await pickTool(page, 'Freedraw (P)')
await page.mouse.move(start.x, start.y)
await page.mouse.down()
for (let i = 1; i <= 12; i++) {
  const point = at(box, 220 + i * 12, 140 + Math.round(Math.sin(i / 1.9) * 50))
  await page.mouse.move(point.x, point.y)
}
await page.mouse.up()

expect(stroke.type).toBe('freedraw')
const points = stroke.points as unknown as Array<[number, number, number]>
expect(points.length).toBe(13)                 // press point + one per move
expect(stroke.x).toBe(220); expect(stroke.y).toBe(140)
expect(points[0]!.slice(0, 2)).toEqual([0, 0]) // anchored at the press
expect(points[0]![2]).toBe(0.5)                 // mouse simulates flat pressure
expect((await scene(page)).selection).toEqual([])  // Excalidraw parity (below)
```

The final assertion documents deliberate parity: Excalidraw's pointer-up
excludes freedraw from the post-draw auto-selection
(`.context/excalidraw/.../components/App.tsx`, `activeTool.type !== "freedraw"
&& newElement` guard), and vuedraw's `case 'freedrawing'` in `onPointerUp`
matches it (no `ctx.select`), so the spec pins non-selection.

### G8-C2, `playground/e2e/text.spec.ts`

**"double-clicking existing text reopens the editor with its content"**:

```ts
await page.mouse.dblclick(at(box, 320, 200).x, at(box, 320, 200).y)
await expect(editor).toBeVisible(); await expect(editor).toBeFocused()
await expect(editor).toHaveValue('hello vuedraw')   // seeded, not empty
await page.keyboard.type('!'); await page.keyboard.press('Escape')
await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
expect(edited.id).toBe(created.id)                  // same element, extended
expect(edited.text).toBe('hello vuedraw!')
```

**"clicking existing text with the text tool edits it in place"**: the spec
that drove this round's implementation change:

```ts
await pickTool(page, 'Text (T)')
await page.mouse.click(at(box, 320, 200).x, at(box, 320, 200).y)
await expect(editor).toBeFocused()
await expect(editor).toHaveValue('hello vuedraw')   // no new element created
await page.keyboard.type(' again'); await page.keyboard.press('Escape')
await expect.poll(async () => (await scene(page)).elements.length).toBe(1)
expect(edited.id).toBe(created.id)
expect(edited.text).toBe('hello vuedraw again')
```

### G4-C1, `playground/e2e/zoom.spec.ts`

**"trackpad pinch-zoom surfaces as ctrl+wheel and zooms toward the cursor"**:

```ts
// Honesty note: Playwright's input API cannot express a two-finger
// pinch. A trackpad pinch never reaches the page as a gesture anyway,
// the browser translates it into a stream of wheel events carrying the
// ctrl modifier (the documented pinch-zoom mechanism in Chrome and
// Safari). This spec drives exactly that event stream: ctrlKey wheel
// ticks dispatched at the cursor position, one per gesture frame.
for (let i = 0; i < 10; i++) {
  host.dispatchEvent(new WheelEvent('wheel', {
    bubbles: true, cancelable: true, ctrlKey: true,
    deltaX: 0, deltaY: -12, clientX: x, clientY: y,
  }))
}
await expect(readout(page)).toHaveText('332%')  // e^1.2 ≈ 3.3201
const after = await staticInkCentroid(page, 160, 40, 320, 320)
expect(after?.count).toBeGreaterThan(before!.count * 1.4)  // shape grew
expect(Math.abs(after!.x - before!.x)).toBeLessThan(6)    // pinned to cursor
expect(Math.abs(after!.y - before!.y)).toBeLessThan(6)
```

**What this spec emulates, stated plainly:** the two-finger gesture itself
is not reproducible through Playwright's input API, and no attempt was made
to fake one. The spec emulates the *mechanism* the browser exposes to the
page, ctrl-modified wheel events at the cursor, which is the exact same
handler path a real trackpad pinch takes (`onWheel`'s `event.ctrlKey`
branch). The 332% readout is deterministic (`Math.exp(-(-12) * 0.01)` per
tick, ten ticks, `Math.round(3.3201 * 100)`); the pre-existing
"ctrl+wheel zooms toward the cursor" spec still independently covers the
keyboard-ctrl form.

### G6-C2 / G8-C3, round-11 receipts re-read and confirmed accurate

- **G6-C2** maps to `playground/e2e/system-theme.spec.ts` ("opens in the dark
  theme with no persisted scene" with `test.use({ colorScheme: 'dark' })`,
  plus "a persisted light theme still wins over the system default") and
  `theme.spec.ts`. Re-read both files this round: the receipts' description
  matches the specs verbatim (data-theme assertions, the `[18, 18, 18]`
  background pixel probe, the 600ms persistence wait before reload). No fix
  needed.
- **G8-C3** maps to the marquee assertions in `draw.spec.ts`: the marquee
  drag in "narrows a multi-selection with a plain click on one shape" starts
  at the empty point (200, 120), outside both shapes' bounds, and
  `expect.poll(... selection.length).toBe(2)` pins that intersecting elements
  are selected; "clears the marquee chrome when the drag ends empty" pins the
  frame teardown. Mapping accurate; no fix needed.

## Commands run locally (actual output quoted)

The e2e suite **cannot be executed in this sandbox** (no TCP bind / no
browser drive, same environment denials proven in the round-5 receipt §3), so
the new specs are delivered typechecked but not browser-run; the user must run
`pnpm e2e` outside the sandbox as in round 11. Everything runnable here was
run, using round-11's documented substitute commands for the sandbox write
denials:

### 1. Core unit suite, PASS (unchanged tree for this package)

```
cd packages/core && ../../node_modules/.bin/vitest run --configLoader runner

 Test Files  11 passed (11)
      Tests  191 passed (191)
   Duration  246ms
```

### 2. Nuxt unit suite (includes the changed package), PASS

```
cd packages/nuxt && ../../node_modules/.bin/vitest run --configLoader runner
      Tests  7 passed (7)
   Duration  103ms
```

### 3. Typechecks, all four passes clean, exit 0

```
packages/core  : pnpm exec tsc --noEmit -p tsconfig.json          → EXIT:0
packages/nuxt  : pnpm exec vue-tsc --noEmit                       → EXIT:0
playground e2e : pnpm exec vue-tsc --noEmit -p tsconfig.e2e.json   → EXIT:0
playground app : pnpm exec vue-tsc --noEmit -p .nuxt/tsconfig.json → EXIT:0
```

The playground-app pass prints the pre-existing vue-tsc plugin warning
(`[Vue] Failed to create plugin TypeError: plugin is not a function`) to
stderr, present on baselines, documented in the round-11 receipt §2, and
the real exit code is still 0 (re-verified with stderr discarded:
`REAL-EXIT:0`). The `.nuxt` snapshot from today already exists, so the
denied `nuxt prepare` preflight was skipped as in round 11.

Because the passes were suspiciously fast, each was adversarially probed
this round: a deliberately ill-typed line added to
`playground/e2e/draw.spec.ts` produced
`e2e/draw.spec.ts(318,7): error TS2322 ... EXIT:2`, and one added inside
`<script setup>` of `VueDrawCanvas.vue` produced
`src/runtime/components/VueDrawCanvas.vue(72,7): error TS2322 ... EXIT:2`.
Both probes were reverted and the files re-verified clean afterwards (the
clean passes quoted above are post-probe-removal).

### 4. Core compile+emit build, PASS (dist writes denied, output redirected)

```
cd packages/core && ../../node_modules/.bin/tsc -p tsconfig.build.json \
  --outDir /tmp/vuedraw-core-dist-r12        → BUILD-EXIT:0
```

The nuxt module's `nuxt-module-build build` writes to `packages/nuxt/dist/`
(denied) and was not re-witnessed; the changed nuxt sources are covered by
the clean `vue-tsc --noEmit` pass over that package plus its unit suite. As
in round 11, a fresh unrestricted `pnpm build` remains the outstanding
authoritative witness for the nuxt dist.

### 5. Lint, no lint script exists

G9-C1 names "linter/typecheck/build commands (as configured in package.json)".
No `lint`/`eslint` script is configured in any package's `package.json`
(only `build`, `test`, `typecheck`, `e2e`, dev helpers), so there is no
configured linter to run; the typecheck and build commands above are the
complete configurable set.

## Summary of gaps recorded honestly

1. **The new specs are typechecked but not browser-run.** The sandbox cannot
   boot the dev server or drive Playwright; `E2E_PORT=<port> pnpm e2e` must be
   run outside (as the user did for round 11) before the new pins count as
   passing evidence.
2. The trackpad-pinch spec emulates the page-visible mechanism (ctrl+wheel),
   not the hardware gesture, Playwright cannot express a two-finger pinch;
   the spec and this receipt say so explicitly.
3. `pnpm build` for the nuxt package and a fresh `nuxt prepare`-backed
   playground typecheck remain un-witnessable here (write denials); core
   compile+emit is proven via the redirected build.
4. The freedraw spec's `points.length` assertion assumes one appended point
   per dispatched `pointermove` (verified against the `case 'freedrawing'`
   handler, which appends unconditionally), if the browser run ever
   coalesces moves, that count is the first assertion to revisit.
5. No lint command exists to run (see §5 above); nothing was lint-checked
   because the repo configures no linter.

## Blockers

1. No TCP bind or loopback connect in this sandbox → e2e suite cannot run
   here (unchanged from rounds 4–6, 11).
2. `.git/` writes denied → no commit/push attempted; the user commits.
