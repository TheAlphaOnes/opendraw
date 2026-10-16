# vuedraw rules

project-specific law for this repo. the root `AGENTS.md` still applies in
full; this file adds the contracts that keep a canvas engine correct.

## boundaries

- `packages/core` imports nothing from vue or nuxt. if a change needs vue
  reactivity, it belongs in `packages/nuxt` (or a core callback/hook).
- `packages/nuxt` treats core as a published library: no deep imports —
  go through `@vuedraw/core`'s index. the playground aliases core to src
  for dev dx only.
- all icons are lucide and all lucide imports go through
  `packages/nuxt/src/runtime/constants/icons.ts`. a component importing
  `lucide-vue-next` directly is a bug.
- ui chrome renders only from the central kit
  (`runtime/components/ui/`). do not hand-roll panels, buttons, swatches,
  or segmented controls in feature components.

## reactivity

- derivations of document state must read through the context: `ctx.state`,
  `ctx.elements`, `ctx.appState`, or a context computed. plain
  `VueDrawDocument` fields never invalidate a vue computed — a computed
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

- `<TextEditor>` is mounted per editing session, never permanently. its
  `onMounted` is the session start (seed value, focus, caret at end);
  unmount is the close. do not reintroduce an always-mounted editor with
  an internal `v-if` — that pattern left the editor unfocusable and
  uncloseable.
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

- `pnpm -r test` (core suite) green.
- `pnpm --filter vuedraw exec vue-tsc --noEmit` clean.
- `pnpm build` emits for both packages.
- canvas-behavior changes get a live check in the playground
  (`pnpm dev`), not just unit tests — the text
  reversal bug passed every unit test and only reproduced in the browser.
