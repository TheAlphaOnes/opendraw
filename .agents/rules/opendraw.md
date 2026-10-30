# opendraw rules

project-specific law for this repo. the root `AGENTS.md` still applies in
full; this file adds the contracts that keep a canvas engine correct.

## behavioral parity

- opendraw must look and behave like excalidraw. this is the contract, not an
  aspiration: when any behavior is ambiguous, match excalidraw instead of
  inventing something.
- the reference codebase is vendored at `.context/excalidraw/`. read it
  before implementing or changing any interaction semantics (selection,
  binding, history granularity, transforms, text editing). cite what excalidraw
  does in the change's reasoning.
- undo entries are scene changes only. app-state-only changes (active tool,
  selection, style, grid, theme) never create history entries — excalidraw's
  undo steps a gesture, never a tool switch.
- one undo press reverts exactly one user gesture: a shape created, a drag
  moved, a text committed. if a tester needs three presses to undo one shape,
  the granularity is wrong.

## boundaries

- `packages/core` and `packages/editor` import nothing from any ui
  framework. behavior (gestures, keyboard, commands, text editing) belongs
  in the editor; an adapter (`packages/nuxt`) only mirrors editor state
  into its reactivity and renders chrome. if a nuxt component grows logic
  another framework would need too, move it into the editor.
- adapters treat core and editor as published libraries: no deep
  imports — go through each package's index. the playground aliases both
  to src for dev dx only.
- all icons are lucide and all lucide imports go through
  `packages/nuxt/src/runtime/constants/icons.ts`. a component importing
  `lucide-vue-next` directly is a bug.
- ui chrome renders only from the central kit
  (`runtime/components/ui/`). do not hand-roll panels, buttons, swatches,
  or segmented controls in feature components.

## reactivity

- derivations of document state must read through the context: `ctx.state`,
  `ctx.elements`, `ctx.appState`, or a context computed. plain
  `OpenDrawDocument` fields never invalidate a vue computed — a computed
  that reads them silently freezes at its first value.
- `state.value` is replaced on every mutation (copy-on-write) and `rev`
  bumps with it. subscribe/watch `rev`, not element contents.
- elements are immutable. every change is a new object; the renderer's
  `WeakMap` drawable cache depends on reference identity, so never mutate
  an element in place.

## history

- pair every `beginStep()` with exactly one `endStep()` or
  `cancelStep()` on every path, including throws.
- user-facing bursts are one step: shape create + its drag, a resize, a
  rotation, text create + edit + commit. do not let partial work pile into
  the next interaction's step.
- viewport (pan/zoom) and theme switches never create history entries.

## text editing

- the text editor (`packages/editor/src/canvas/textEditor.ts`) is one
  session per edit, never permanent: a session starts when `editingId` is
  set (seed value, focus, caret at end) and is disposed when it clears.
  do not reintroduce an always-alive editor — that pattern left the editor
  unfocusable and uncloseable.
- the textarea is uncontrolled while editing: seed once from state, then
  let the browser own caret/composition. never bind `value` (or
  `v-model`) on an input the user is actively editing.
- the textarea's layout box is fixed for the session. resizing a focused
  editable between insertions resets chromium's ime/inserttext caret to 0
  and reverses typed text — if a size must change, change a wrapper, not
  the focused element.
- guard every session-lifecycle flag (`committed` and friends) so a stray
  event with no active session cannot poison it for the real one.

## rendering and input

- `renderScene` owns the static canvas, `renderOverlay` the chrome; do
  not draw chrome into the scene or scene into the chrome.
- pointer handlers must survive synthetic/untrusted events: wrap
  `setPointerCapture` (and any api with an active-pointer precondition)
  in try/catch. automation and test streams dispatch untrusted events.
- transform math reads the snapshot taken at pointerdown, never live
  elements.
- the user-set canvas background is data: dark mode may invert element
  colors, never the background. theme switches swap only the default
  background and leave customized ones alone.

## gates

before declaring any change done:

- `pnpm test` (core, editor and nuxt suites) green.
- `pnpm typecheck` clean (every package and the playground).
- `pnpm build` emits for all three packages.
- `pnpm e2e` green.
- canvas-behavior changes get a live check in the playground
  (`pnpm dev`), not just unit tests — the text
  reversal bug passed every unit test and only reproduced in the browser.
