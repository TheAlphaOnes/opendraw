# vuedraw

an excalidraw-style hand-drawn canvas for the nuxt 4 ecosystem: a pnpm
monorepo publishing `@vuedraw/core` (framework-free engine) and `vuedraw`
(the nuxt module consumers install). the reference excalidraw codebase
lives in `.context/excalidraw/` — mine it for behavior contracts before
inventing anything; this repo's job is the nuxt-native version of the
patterns proven there, not a port.

## packages

| path              | name             | role                                                                    |
| ----------------- | ---------------- | ----------------------------------------------------------------------- |
| `packages/core`   | `@vuedraw/core`  | the engine: element model, geometry, scene store, hit testing, transforms, rough.js renderer, export. zero vue/nuxt imports — runs in node (tests) and the browser alike. |
| `packages/nuxt`   | `vuedraw`        | the module: `<VueDraw>` shell + `<VueDrawCanvas>` headless core + `useVueDraw()` composable + the central ui kit. registers components and auto-imports. |
| `playground/`     | —                | nuxt 4 app for manual verification: `/` full editor, `/headless` canvas-only with custom chrome. |
| `.context/excalidraw/` | —           | the reference codebase. excalidraw parity is the behavior contract: when anything is ambiguous, read this and match it. |

## behavioral contract

vuedraw is an excalidraw clone for the nuxt ecosystem. that is the product:
same look, same feel, same interactions. `.context/excalidraw/` is the
source of truth for behavior — selection semantics, arrow binding, history
granularity (one undo = one gesture, never a tool switch), transforms, text
editing. before implementing or changing an interaction, read how excalidraw
does it and cite the file when you deviate.

## commands

```sh
pnpm -r test          # core vitest suite (111 tests)
pnpm build            # core + nuxt package builds
pnpm --filter vuedraw exec vue-tsc --noEmit   # module typecheck gate
pnpm dev                                      # playground at :3000
```

module build uses `nuxt-module-build` (from `@nuxt/module-builder`) — the
bin name is `nuxt-module-build`, not `nuxt-module-builder`.

## architecture contracts

these are load-bearing; changing one is a redesign, not a refactor.

- **one write funnel.** `VueDrawDocument.mutate()` is the only path that
  touches elements/appstate. every mutation replaces `state.value`
  (copy-on-write) and bumps `rev`. reactive derivations must read through
  `ctx.state` / `ctx.elements` / other context computeds — never plain doc
  fields, which never invalidate a computed. the text editor hit this:
  reading `doc.getElement()` froze its element computed, commit saw stale
  empty text, and escape deleted the committed element.
- **history = steps.** `beginStep/endStep/cancelStep` group a burst into
  one undo entry; add/delete coalesce via the topLevel check. viewport
  changes never create entries. text creation + editing is ONE step: the
  canvas opens it at creation, the editor's `commit()` closes it.
- **hard delete, no tombstones.** v1 has no collaboration layer, so
  deleted elements leave the array and snapshot history carries undo.
- **plain array order is z-order.** no fractional indexing.
- **render: two canvases.** static scene + interactive chrome (selection,
  handles, marquee). rough.js drawables are cached in a `WeakMap` keyed by
  element reference with the theme recorded alongside. dark mode inverts
  element colors in-canvas; the user-set background is never filtered —
  the theme switch swaps the default (`#ffffff` <-> `#121212`) and leaves
  customized backgrounds alone.
- **text editing is a session.** `<TextEditor>` mounts per session
  (`v-if="editingActive"` on the component in `VueDrawCanvas`), seeds the
  textarea once from state, then the browser owns the editing state. the
  textarea keeps a session-stable box (width/height fixed at open):
  resizing a focused editable mid-typing resets chromium's ime/inserttext
  caret to 0, which character-reverses typed text. never bind `value` on
  an actively-edited input.
- **interaction math reads pointerdown snapshots** (originals), never
  live elements — prevents drift. resize never flips (clamped positive);
  rotation uses the `5*pi/2 + atan2` pointer-angle convention.
- **pointer capture is best-effort.** synthetic/untrusted pointer events
  carry no active pointer id; `setPointerCapture` is wrapped in try/catch
  or an automation stream kills the state machine mid-handler.

## module surface

- `<VueDraw ui="full|minimal|none" theme="light|dark">` — the shell.
  emits `change({ elements })` and `select(ids)`.
- `<VueDrawCanvas>` — headless core for custom chrome.
- `useVueDraw()`, `createVueDrawContext()`, `provideVueDraw()` — the
  context api. `createVueDrawContext({ elements, appState })` is how the
  playground's `/headless` page drives the same context its own toolbar
  talks to.
- all ui chrome renders from the central kit (`components/ui/`) and all
  icons come from the lucide registry (`constants/icons.ts` is the only
  lucide import point).

## verification state (2026-10-17)

browser-verified in brave via agent-browser: shape drawing, edge-click
selection, handle resize, undo/redo, text create -> type -> escape commit
(multi-line and click-away too), freedraw strokes, headless page (dark
background, custom chrome, undo state), theme toggle swapping the default
background, console clean under the fixed code. gates: core 111/111,
`vue-tsc --noEmit` clean, both package builds emit.

environment note: the automation window runs hidden
(`document.visibilityState === "hidden"`), which defers resizeobserver
delivery — the canvas paints on first state change instead of at mount.
that is an artifact of the hidden window, not a cold-start bug; visible
windows deliver the initial size normally.

## standing user constraints

- additive edits only when the user asks for something new; never
  restructure content they did not name.
- commit automatically after each coherent change (lowercase imperative
  subject, why in the body, selective staging, never push unless asked).
- free tiers only; no paid platforms.
- all icons lucide, through the central registry.
- one central reusable component set; never remake the same ui piece.
