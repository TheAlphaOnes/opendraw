<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import type {
  Bounds,
  HandleDirection,
  Point,
  ResizeHandle,
  SelectionFrame,
  ToolId,
  VueDrawBindableShape,
  VueDrawElement,
  VueDrawLinearElement,
} from '@vuedraw/core'
import {
  applyViewportTransform,
  bindableShapeAt,
  bindingFollowPatches,
  computeLinearBindings,
  computeTipBinding,
  draftLinePoints,
  draftShapeRect,
  elementsInBounds,
  elementsUnderEraser,
  findElementAt,
  getHandleLayout,
  handleAt,
  hitThreshold,
  isFreedrawElement,
  isLinearElement,
  linearHandleAt,
  linearMidpointHandle,
  linearPointHandles,
  localPointOf,
  maxBindingDistance,
  moveElements,
  moveLinearPoint,
  newElement,
  newFreedrawElement,
  newFrameElement,
  newLinearElement,
  newTextElement,
  pointInSelectionFrame,
  pointsPatch,
  renderOverlay,
  renderScene,
  resizeCursorFor,
  resizeMultipleElements,
  resizeSingleElement,
  rotateElements,
  screenToScene,
  selectionFrameOf,
  sideHandleAt,
  startRotationAngle,
} from '@vuedraw/core'

import { useVueDraw } from '../composables/useVueDraw.js'
import {
  imageDataUrlsOf,
  imageResolver,
  isImageFile,
  requestImageDecode,
} from '../services/image.service.js'
import TextEditor from './TextEditor.vue'

/**
 * VueDrawCanvas — the headless editor core.
 *
 * Owns the two-canvas renderer (static scene + interactive chrome) and the
 * pointer state machine. No UI chrome lives here; <VueDraw> composes this
 * with the toolbar/panels. Pointing this component at the same provided
 * context is how headless consumers embed just the canvas.
 */

const emit = defineEmits<{
  (e: 'contextmenu', payload: { x: number; y: number }): void
}>()

const ctx = useVueDraw()

/**
 * The wysiwyg editor mounts per editing session: every open gets a fresh
 * component (fresh `committed` flag, freshly registered window listeners)
 * and every close unmounts it. Mounting it permanently with an internal
 * v-if left its session lifecycle hooks dead — the textarea never received
 * focus and `committed` stayed poisoned after the first stray commit.
 */
const editingActive = computed(() => ctx.editingId.value !== null)

// ---------------------------------------------------------------------------
// DOM refs & canvas plumbing
// ---------------------------------------------------------------------------

const hostRef = ref<HTMLDivElement | null>(null)
const staticRef = ref<HTMLCanvasElement | null>(null)
const overlayRef = ref<HTMLCanvasElement | null>(null)

const canvasSize = shallowRef({ width: 0, height: 0 })
const dpr = ref(1)

/** Marquee rect while drag-selecting, in scene coords. */
const marquee = shallowRef<Bounds | null>(null)
/** Space bar held → temporary pan mode. */
const spaceDown = ref(false)

let resizeObserver: ResizeObserver | null = null
let renderFrame = 0

function observeSize() {
  const host = hostRef.value
  if (!host) {
    return
  }
  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) {
      return
    }
    const { width, height } = entry.contentRect
    const ratio = window.devicePixelRatio || 1
    dpr.value = ratio
    canvasSize.value = { width: Math.max(1, Math.floor(width)), height: Math.max(1, Math.floor(height)) }
    for (const canvas of [staticRef.value, overlayRef.value]) {
      if (canvas) {
        canvas.width = Math.floor(canvasSize.value.width * ratio)
        canvas.height = Math.floor(canvasSize.value.height * ratio)
      }
    }
    scheduleRender()
  })
  resizeObserver.observe(host)
}

// ---------------------------------------------------------------------------
// Render loop — rAF coalesced, driven by document changes
// ---------------------------------------------------------------------------

function scheduleRender() {
  if (renderFrame) {
    return
  }
  renderFrame = requestAnimationFrame(() => {
    renderFrame = 0
    renderAll()
  })
}

function renderAll() {
  const size = canvasSize.value
  if (size.width === 0 || size.height === 0) {
    return
  }
  const staticCanvas = staticRef.value
  const overlayCanvas = overlayRef.value
  if (!staticCanvas || !overlayCanvas) {
    return
  }
  const staticCtx = staticCanvas.getContext('2d')
  const overlayCtx = overlayCanvas.getContext('2d')
  if (!staticCtx || !overlayCtx) {
    return
  }
  const state = ctx.state.value

  renderScene(staticCtx, {
    elements: state.elements,
    appState: {
      theme: state.appState.theme,
      viewBackgroundColor: state.appState.viewBackgroundColor,
      viewport: state.appState.viewport,
      gridSize: state.appState.gridSize,
      editingId: state.appState.editingId,
    },
    canvasSize: size,
    dpr: dpr.value,
    // Decoded bitmaps come from the shared cache; misses render placeholders.
    resolveImage: imageResolver,
  })

  renderOverlay(overlayCtx, {
    selectedElements: ctx.selectedElements.value,
    appState: {
      theme: state.appState.theme,
      viewport: state.appState.viewport,
      editingId: state.appState.editingId,
    },
    pointer: 'mouse',
    marquee: marquee.value,
    previewElements: [],
    bindingCandidates: bindingCandidates.value,
    canvasSize: size,
    dpr: dpr.value,
  })

  drawLaserTrail(overlayCtx)
}

// ---------------------------------------------------------------------------
// Image decode sweep — keeps the shared bitmap cache warm
// ---------------------------------------------------------------------------

// A decode landing repaints once; the rAF-coalesced render loop does the rest.
watch(
  () => ctx.state.value.elements,
  (elements) => {
    for (const dataUrl of imageDataUrlsOf(elements)) {
      requestImageDecode(dataUrl, scheduleRender)
    }
  },
  { immediate: true },
)

// ---------------------------------------------------------------------------
// Laser trail — transient overlay ink, never document state
// ---------------------------------------------------------------------------

interface LaserPoint {
  x: number
  y: number
  /** Performance timestamp — points fade out by age. */
  t: number
}

const LASER_COLOR = '#ff2698'
const LASER_FADE_MS = 1000

/** Live trail in scene coordinates; trimmed by the fade loop below. */
let laserTrail: LaserPoint[] = []
let laserFadeFrame = 0

function scheduleLaserFade(): void {
  if (laserFadeFrame) {
    return
  }
  laserFadeFrame = requestAnimationFrame(() => {
    laserFadeFrame = 0
    const cutoff = performance.now() - LASER_FADE_MS
    laserTrail = laserTrail.filter((p) => p.t > cutoff)
    scheduleRender()
    if (laserTrail.length > 0) {
      scheduleLaserFade()
    }
  })
}

/** Draws the fading pointer trail straight onto the overlay canvas. */
function drawLaserTrail(target: CanvasRenderingContext2D): void {
  if (laserTrail.length < 2) {
    return
  }
  const { viewport } = ctx.state.value.appState
  const now = performance.now()
  target.save()
  applyViewportTransform(target, viewport, dpr.value)
  target.lineCap = 'round'
  target.lineJoin = 'round'
  for (let i = 1; i < laserTrail.length; i++) {
    const a = laserTrail[i - 1]!
    const b = laserTrail[i]!
    const age = Math.max(a.t, b.t)
    const alpha = Math.max(0, 1 - (now - age) / LASER_FADE_MS)
    if (alpha <= 0) {
      continue
    }
    target.strokeStyle = LASER_COLOR
    target.globalAlpha = alpha
    target.lineWidth = 4
    target.beginPath()
    target.moveTo(a.x, a.y)
    target.lineTo(b.x, b.y)
    target.stroke()
  }
  target.restore()
}


watch(() => ctx.state.value.rev, scheduleRender)
watch(canvasSize, scheduleRender)
// The marquee is pure overlay ink: `ctx.select` short-circuits once the
// dragged rect covers everything under it, so no document rev change keeps
// flowing — the rect itself must schedule its repaint or it visually
// freezes the moment the selection set stops growing.
watch(marquee, scheduleRender)

onMounted(() => {
  observeSize()
  scheduleRender()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (renderFrame) {
    cancelAnimationFrame(renderFrame)
  }
  if (laserFadeFrame) {
    cancelAnimationFrame(laserFadeFrame)
  }
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('keydown', onKeyDownGlobal)
  window.removeEventListener('paste', onPaste)
})

// ---------------------------------------------------------------------------
// Coordinate mapping
// ---------------------------------------------------------------------------

function toScene(event: PointerEvent | WheelEvent | MouseEvent): Point {
  const host = hostRef.value
  const rect = host!.getBoundingClientRect()
  return screenToScene(
    { x: event.clientX - rect.left, y: event.clientY - rect.top },
    ctx.viewport.value,
  )
}

function toScreenLength(length: number): number {
  return length * ctx.viewport.value.zoom
}

// ---------------------------------------------------------------------------
// Pointer state machine
// ---------------------------------------------------------------------------

type Interaction =
  | { kind: 'none' }
  | { kind: 'panning'; lastScreen: Point }
  | { kind: 'marquee'; originScene: Point; baseIds: string[] }
  | { kind: 'creating'; elementId: string; originScene: Point }
  | { kind: 'freedrawing'; elementId: string }
  | {
      kind: 'moving'
      originScene: Point
      originals: readonly VueDrawElement[]
      /** Element to narrow the selection to on a no-drag pointerup, or null. */
      hitId: string | null
      didDrag: boolean
    }
  | { kind: 'resizing'; handle: HandleDirection; originals: readonly VueDrawElement[] }
  | {
      kind: 'rotating'
      originals: readonly VueDrawElement[]
      frame: ReturnType<typeof selectionFrameOf>
      startAngle: number
    }
  | { kind: 'erasing'; lastScene: Point }
  | { kind: 'laser' }
  | {
      kind: 'movingPoint'
      elementId: string
      index: number
      /** Which tip the moved point is — start, end — or a midpoint (null). */
      end: 'start' | 'end' | null
    }
  | {
      kind: 'draftingLinear'
      elementId: string
      /** Points committed so far; a trailing temp point may follow beyond it. */
      committedCount: number
    }

const interaction = shallowRef<Interaction>({ kind: 'none' })
const modifiers = shallowRef({ shift: false })
/** Shapes the live line/arrow probes would dock onto — outlined on the overlay. */
const bindingCandidates = shallowRef<readonly VueDrawBindableShape[]>([])
/** Scene point under an idle pointer — drives the hover cursor + probes. */
const hoverScene = shallowRef<Point | null>(null)
// Idle-hover highlight changes no document state, so the candidates array
// itself must schedule the repaint.
watch(bindingCandidates, scheduleRender)

function setModifiers(event: PointerEvent | MouseEvent | KeyboardEvent) {
  modifiers.value = { shift: event.shiftKey }
}

const handleLayout = computed(() => {
  const selected = ctx.selectedElements.value
  if (selected.length === 0) {
    return []
  }
  const frame = selectionFrameOf(selected)
  if (!frame) {
    return []
  }
  return getHandleLayout(frame, { zoom: ctx.viewport.value.zoom, pointer: 'mouse' })
})

/** Shape tools that draft by dragging. */
const SHAPE_TOOLS = new Set(['rectangle', 'diamond', 'ellipse', 'line', 'arrow', 'frame'])

function onPointerDown(event: PointerEvent) {
  const host = hostRef.value
  if (!host) {
    return
  }
  // preventScroll: a focus-induced scroll would move the host rect between
  // this call and toScene(), silently offsetting every scene coordinate by
  // the scroll delta. Bites on any page where the canvas is partly
  // offscreen — the host is focused on every gesture start.
  host.focus({ preventScroll: true })
  // Untrusted/synthetic pointer events carry no active pointer entry, so
  // capture is best-effort: an automation or test event stream must not
  // abort the interaction state machine mid-handler.
  try {
    host.setPointerCapture(event.pointerId)
  } catch {
    // No active pointer with this id — continue without capture.
  }
  setModifiers(event)
  // A new gesture starts from a clean slate — a stale highlight must not
  // survive into the next interaction.
  bindingCandidates.value = []

  const scenePoint = toScene(event)
  const tool = ctx.activeTool.value

  // Panning: middle button, hand tool, or space.
  if (event.button === 1 || tool === 'hand' || spaceDown.value) {
    interaction.value = { kind: 'panning', lastScreen: { x: event.clientX, y: event.clientY } }
    return
  }
  if (event.button !== 0) {
    return
  }

  // A press while a multi-point draft is live continues the draft when the
  // line/arrow tool is still armed; any other gesture finishes it first.
  if (interaction.value.kind === 'draftingLinear') {
    if (tool === 'line' || tool === 'arrow') {
      appendDraftPoint(scenePoint)
      return
    }
    finishLinearDraft()
  }

  // Text tool: Excalidraw parity — a click on an existing text element
  // re-opens ITS editor (App.textTool resolves a "text" target before
  // falling through to free creation); anywhere else creates a new one.
  if (tool === 'text') {
    const hit = findElementAt(
      ctx.elements.value,
      scenePoint,
      hitThreshold(ctx.viewport.value.zoom),
    )
    if (hit?.type === 'text') {
      // Same shape as a creation: one open step the editor commits into,
      // the element selected, and the tool reverted to selection.
      ctx.doc.beginStep()
      ctx.select(hit.id)
      ctx.setActiveTool('selection')
      ctx.setEditing(hit.id)
      return
    }
    createTextAt(scenePoint)
    return
  }

  if (tool === 'eraser') {
    ctx.doc.beginStep()
    interaction.value = { kind: 'erasing', lastScene: scenePoint }
    eraseAlong(scenePoint, scenePoint)
    return
  }

  // Image tool: a press opens the file picker (Excalidraw parity — inserting
  // is a gesture, not a persistent mode).
  if (tool === 'image') {
    ctx.openImagePicker()
    return
  }

  // Laser: pure overlay ink, no document step.
  if (tool === 'laser') {
    laserTrail = [{ x: scenePoint.x, y: scenePoint.y, t: performance.now() }]
    interaction.value = { kind: 'laser' }
    scheduleRender()
    return
  }

  if (SHAPE_TOOLS.has(tool)) {
    const element = draftElement(tool, scenePoint)
    ctx.doc.beginStep()
    ctx.doc.addElement(element)
    interaction.value = { kind: 'creating', elementId: element.id, originScene: scenePoint }
    // A drag starting on a shape highlights it from the first frame — the
    // start tip is a binding candidate exactly like the dragged one.
    if (tool === 'line' || tool === 'arrow') {
      const shape = bindableShapeAt(
        ctx.elements.value,
        scenePoint,
        maxBindingDistance(ctx.viewport.value.zoom),
        element.id,
      )
      bindingCandidates.value = shape ? [shape] : []
    }
    return
  }

  if (tool === 'freedraw') {
    const element = newFreedrawElement({
      x: scenePoint.x,
      y: scenePoint.y,
      style: ctx.appState.value.style,
      simulatePressure: event.pointerType === 'mouse',
      points: [[0, 0, pressureOf(event)]],
    })
    ctx.doc.beginStep()
    ctx.doc.addElement(element)
    interaction.value = { kind: 'freedrawing', elementId: element.id }
    return
  }

  // Selection tool.
  // Point handles of a lone selected line/arrow outrank the box chrome —
  // Excalidraw grabs endpoints by their circles, never the corner boxes.
  const loneLinear = loneSelectedLinear()
  if (loneLinear) {
    const zoom = ctx.viewport.value.zoom
    const pointHit = linearHandleAt(linearPointHandles(loneLinear), scenePoint, zoom)
    if (pointHit) {
      interaction.value = {
        kind: 'movingPoint',
        elementId: loneLinear.id,
        index: pointHit.index,
        end:
          pointHit.index === 0
            ? 'start'
            : pointHit.index === loneLinear.points.length - 1
              ? 'end'
              : null,
      }
      ctx.doc.beginStep()
      return
    }
    const mid = linearMidpointHandle(loneLinear)
    if (mid && linearHandleAt([mid], scenePoint, zoom)) {
      // Pressing the segment midpoint inserts a point there and drags it —
      // the two-point line grows to three.
      ctx.doc.beginStep()
      const points = loneLinear.points.map((point) => ({ ...point }))
      points.splice(mid.index, 0, localPointOf(loneLinear, mid.at))
      ctx.doc.forceUpdateElement(loneLinear.id, pointsPatch(loneLinear, points))
      interaction.value = {
        kind: 'movingPoint',
        elementId: loneLinear.id,
        index: mid.index,
        end: null,
      }
      return
    }
  }

  const handle = handleAt(handleLayout.value, scenePoint)
  if (handle === 'rotation') {
    const originals = snapshotSelection()
    const frame = selectionFrameOf(originals)!
    interaction.value = {
      kind: 'rotating',
      originals,
      frame,
      startAngle: startRotationAngle(frame, scenePoint),
    }
    ctx.doc.beginStep()
    return
  }
  if (handle) {
    const originals = snapshotSelection()
    interaction.value = { kind: 'resizing', handle, originals }
    ctx.doc.beginStep()
    return
  }

  // Border grabbing: a press within a few pixels of the selection border
  // resizes from that side, like Excalidraw's side resizing. A lone
  // two-point linear stays drag-only, exactly as Excalidraw excludes it.
  const frame = selectionFrameOf(ctx.selectedElements.value)
  if (frame) {
    const side = sideGrabAt(scenePoint, frame, ctx.viewport.value.zoom)
    if (side) {
      const originals = snapshotSelection()
      interaction.value = { kind: 'resizing', handle: side, originals }
      ctx.doc.beginStep()
      return
    }
  }

  const threshold = hitThreshold(ctx.viewport.value.zoom)
  const hit = findElementAt(ctx.elements.value, scenePoint, threshold)
  if (hit) {
    const wasSelected = ctx.isIdSelected(hit.id)
    if (event.shiftKey) {
      ctx.select(hit.id, 'toggle')
    } else if (!wasSelected) {
      ctx.select(hit.id)
    }
    // Locked elements stay selectable but immovable.
    if (ctx.selectedElements.value.every((el) => el.locked)) {
      interaction.value = { kind: 'none' }
      return
    }
    // Excalidraw parity: pointerdown on an element inside a multi-selection
    // keeps the group so a drag moves it together; a no-drag click narrows
    // the selection to the hit on pointerup instead.
    interaction.value = {
      kind: 'moving',
      originScene: scenePoint,
      originals: snapshotSelection(),
      hitId: !event.shiftKey && wasSelected ? hit.id : null,
      didDrag: false,
    }
    ctx.doc.beginStep()
    return
  }

  // Pressing inside the current selection's frame grabs the whole
  // selection — Excalidraw's common-bounding-box grab, extended to lone
  // selections so an unfilled shape drags from its middle, not just its
  // outline. Shift keeps the add-to-selection gesture instead.
  if (
    frame &&
    !event.shiftKey &&
    !ctx.selectedElements.value.every((el) => el.locked) &&
    pointInSelectionFrame(
      frame,
      scenePoint,
      SELECTION_GRAB_PADDING / ctx.viewport.value.zoom,
    )
  ) {
    interaction.value = {
      kind: 'moving',
      originScene: scenePoint,
      originals: snapshotSelection(),
      // No element was pressed, so a no-drag click keeps the selection.
      hitId: null,
      didDrag: false,
    }
    ctx.doc.beginStep()
    return
  }

  // Empty space: marquee. Shift keeps the existing selection as a base.
  interaction.value = {
    kind: 'marquee',
    originScene: scenePoint,
    baseIds: event.shiftKey ? ctx.selectedElements.value.map((el) => el.id) : [],
  }
  if (!event.shiftKey) {
    ctx.select(null)
  }
  marquee.value = null
}

/**
 * Suppress the mousedown default (focus move) for presses on the host
 * itself. Focus is managed explicitly in `onPointerDown`, and the default
 * steals focus from a text editor mounted mid-press: pointerdown creates
 * the element, the editor mounts and focuses on the microtask checkpoint,
 * and the trailing mousedown would then blur it — committing the empty
 * draft and rolling the whole step back. Presses on child elements (the
 * text editor's textarea) keep their native behavior.
 */
function onMouseDown(event: MouseEvent): void {
  if (hostRef.value !== null && event.target === hostRef.value) {
    event.preventDefault()
  }
}

function onPointerMove(event: PointerEvent) {
  setModifiers(event)
  const current = interaction.value
  if (current.kind === 'none') {
    handleIdleHover(toScene(event))
    return
  }
  const scenePoint = toScene(event)

  switch (current.kind) {
    case 'panning': {
      const dx = event.clientX - current.lastScreen.x
      const dy = event.clientY - current.lastScreen.y
      current.lastScreen = { x: event.clientX, y: event.clientY }
      ctx.panBy(dx, dy)
      return
    }
    case 'marquee': {
      const bounds: Bounds = {
        x1: Math.min(current.originScene.x, scenePoint.x),
        y1: Math.min(current.originScene.y, scenePoint.y),
        x2: Math.max(current.originScene.x, scenePoint.x),
        y2: Math.max(current.originScene.y, scenePoint.y),
      }
      marquee.value = bounds
      const inside = elementsInBounds(ctx.elements.value, bounds)
      const ids = new Set(current.baseIds)
      for (const el of inside) {
        ids.add(el.id)
      }
      ctx.select([...ids])
      return
    }
    case 'creating': {
      const el = ctx.doc.getElement(current.elementId)
      if (!el) {
        return
      }
      if (el.type === 'line' || el.type === 'arrow') {
        const points = draftLinePoints(current.originScene, scenePoint, modifiers.value)
        ctx.doc.forceUpdateElement(el.id, pointsPatch(el, points))
        // Connect feedback: outline every shape the line would bind — the
        // one under the dragged tip AND the one the drag started on.
        // The draft is never rotated, so scene position is origin + point.
        const tip = points[points.length - 1]!
        const distance = maxBindingDistance(ctx.viewport.value.zoom)
        const startShape = bindableShapeAt(
          ctx.elements.value,
          current.originScene,
          distance,
          el.id,
        )
        const tipShape = bindableShapeAt(
          ctx.elements.value,
          { x: el.x + tip.x, y: el.y + tip.y },
          distance,
          el.id,
        )
        bindingCandidates.value = mergeBindingCandidates([startShape, tipShape])
      } else {
        const rect = draftShapeRect(current.originScene, scenePoint, modifiers.value)
        ctx.doc.forceUpdateElement(el.id, rect)
      }
      return
    }
    case 'freedrawing': {
      const el = ctx.doc.getElement(current.elementId)
      if (!el || !isFreedrawElement(el)) {
        return
      }
      const points = [
        ...el.points,
        [scenePoint.x - el.x, scenePoint.y - el.y, pressureOf(event)],
      ]
      ctx.doc.forceUpdateElement(el.id, { points })
      return
    }
    case 'moving': {
      const delta: Point = {
        x: scenePoint.x - current.originScene.x,
        y: scenePoint.y - current.originScene.y,
      }
      if (delta.x !== 0 || delta.y !== 0) {
        current.didDrag = true
      }
      const patches = moveElements(current.originals, delta, ctx.gridSize.value)
      for (const { id, patch } of patches) {
        ctx.doc.forceUpdateElement(id, patch)
      }
      followBindings(current.originals)
      return
    }
    case 'movingPoint': {
      const el = ctx.doc.getElement(current.elementId)
      if (!el || !isLinearElement(el)) {
        return
      }
      ctx.doc.forceUpdateElement(el.id, moveLinearPoint(el, current.index, scenePoint))
      // Binding feedback while a tip is dragged: outline the shape it
      // would dock onto.
      if (current.end) {
        const shape = bindableShapeAt(
          ctx.elements.value,
          scenePoint,
          maxBindingDistance(ctx.viewport.value.zoom),
          el.id,
        )
        bindingCandidates.value = shape ? [shape] : []
      }
      return
    }
    case 'draftingLinear': {
      const el = ctx.doc.getElement(current.elementId)
      if (!el || !isLinearElement(el)) {
        return
      }
      // The trailing temp point follows the cursor between clicks; if a
      // retreat popped it, the first move spins a fresh one up.
      const points = el.points.map((point) => ({ ...point }))
      const local = localPointOf(el, scenePoint)
      if (points.length === current.committedCount) {
        points.push({ ...local })
      } else {
        points[points.length - 1] = local
      }
      ctx.doc.forceUpdateElement(el.id, pointsPatch(el, points))
      const shape = bindableShapeAt(
        ctx.elements.value,
        scenePoint,
        maxBindingDistance(ctx.viewport.value.zoom),
        el.id,
      )
      bindingCandidates.value = shape ? [shape] : []
      return
    }
    case 'resizing': {
      const patch =
        current.originals.length === 1
          ? resizeSingleElement(current.originals[0]!, current.handle, scenePoint, modifiers.value)
          : null
      if (patch && current.originals.length === 1) {
        ctx.doc.forceUpdateElement(current.originals[0]!.id, patch)
        followBindings(current.originals)
        return
      }
      const patches = resizeMultipleElements(
        current.originals,
        current.handle,
        scenePoint,
        modifiers.value,
      )
      for (const { id, patch: p } of patches) {
        ctx.doc.forceUpdateElement(id, p)
      }
      followBindings(current.originals)
      return
    }
    case 'rotating': {
      const patches = rotateElements(
        current.originals,
        current.frame!,
        current.startAngle,
        scenePoint,
        modifiers.value,
      )
      for (const { id, patch } of patches) {
        ctx.doc.forceUpdateElement(id, patch)
      }
      followBindings(current.originals)
      return
    }
    case 'erasing': {
      eraseAlong(current.lastScene, scenePoint)
      current.lastScene = scenePoint
      return
    }
    case 'laser': {
      laserTrail.push({ x: scenePoint.x, y: scenePoint.y, t: performance.now() })
      scheduleRender()
      scheduleLaserFade()
      return
    }
  }
}

function onPointerUp(event: PointerEvent) {
  const current = interaction.value
  interaction.value = { kind: 'none' }
  marquee.value = null
  bindingCandidates.value = []
  const host = hostRef.value
  if (host?.hasPointerCapture(event.pointerId)) {
    host.releasePointerCapture(event.pointerId)
  }

  switch (current.kind) {
    case 'creating': {
      const el = ctx.doc.getElement(current.elementId)
      if (el) {
        const tooSmall =
          (el.type === 'rectangle' || el.type === 'diamond' || el.type === 'ellipse' || el.type === 'frame') &&
          el.width < 2 &&
          el.height < 2
        const emptyLine =
          (el.type === 'line' || el.type === 'arrow') &&
          (el.points.length < 2 || (el.points[1]!.x === 0 && el.points[1]!.y === 0))
        if (emptyLine) {
          // Excalidraw's multi-point creation: a no-drag click parks the
          // first point and keeps the draft live — each later click beyond
          // the commit threshold appends a point until Enter, Escape or a
          // double-click ends it.
          ctx.doc.forceUpdateElement(el.id, { points: [{ x: 0, y: 0 }, { x: 0, y: 0 }] })
          interaction.value = { kind: 'draftingLinear', elementId: el.id, committedCount: 1 }
          return
        }
        if (tooSmall) {
          ctx.doc.cancelStep()
          return
        }
        if (isLinearElement(el)) {
          // Tips dropped over (or near) a shape dock onto it before the
          // creation step closes — the bind is part of the draw's undo entry.
          const binding = computeLinearBindings(
            el,
            ctx.elements.value,
            maxBindingDistance(ctx.viewport.value.zoom),
          )
          if (binding) {
            ctx.doc.updateElement(el.id, binding)
          }
        }
        ctx.doc.endStep()
        ctx.select(el.id)
        ctx.setActiveTool('selection')
      }
      return
    }
    case 'freedrawing': {
      const el = ctx.doc.getElement(current.elementId)
      if (!el || !isFreedrawElement(el) || el.points.length < 2) {
        ctx.doc.cancelStep()
        return
      }
      ctx.doc.endStep()
      ctx.setActiveTool('selection')
      return
    }
    case 'moving': {
      ctx.doc.endStep()
      // A no-drag click on an element inside a multi-selection narrows the
      // selection to it; a drag moved the whole group instead.
      if (!current.didDrag && current.hitId) {
        ctx.select(current.hitId)
      }
      return
    }
    case 'movingPoint': {
      const el = ctx.doc.getElement(current.elementId)
      if (el && isLinearElement(el) && current.end) {
        // Release-time docking: a tip dropped on (or near) a shape binds to
        // it; dropped loose, any previous binding clears.
        const patch = computeTipBinding(
          el,
          current.end,
          ctx.elements.value,
          maxBindingDistance(ctx.viewport.value.zoom),
        )
        ctx.doc.updateElement(el.id, patch)
      }
      ctx.doc.endStep()
      return
    }
    case 'draftingLinear': {
      // The commit/retreat logic lives on pointerdown (Excalidraw's
      // multiElement flow) — the release just keeps the draft live.
      interaction.value = {
        kind: 'draftingLinear',
        elementId: current.elementId,
        committedCount: current.committedCount,
      }
      return
    }
    case 'resizing':
    case 'rotating': {
      ctx.doc.endStep()
      return
    }
    case 'erasing': {
      ctx.doc.endStep()
      return
    }
    default:
      return
  }
}

/**
 * Binding follow-through after a drag: lines and arrows bound to any of the
 * just-moved elements re-dock their tips onto the new geometry, and moved
 * linear elements glide along the edges of the shapes they are bound to.
 */
function followBindings(originals: readonly VueDrawElement[]): void {
  const movedIds = new Set(originals.map((el) => el.id))
  for (const [id, patch] of bindingFollowPatches(movedIds, ctx.elements.value)) {
    ctx.doc.updateElement(id, patch)
  }
}

function snapshotSelection(): readonly VueDrawElement[] {
  const selected = ctx.selectedElements.value
  return selected.map((el) => ctx.doc.getElement(el.id) ?? el)
}

function pressureOf(event: PointerEvent): number {
  return event.pointerType === 'mouse' ? 0.5 : Math.max(0, Math.min(1, event.pressure))
}

function draftElement(tool: string, at: Point): VueDrawElement {
  if (tool === 'line' || tool === 'arrow') {
    return newLinearElement(tool, {
      x: at.x,
      y: at.y,
      style: ctx.appState.value.style,
      points: [{ x: 0, y: 0 }],
    })
  }
  if (tool === 'frame') {
    return newFrameElement({
      x: at.x,
      y: at.y,
      style: ctx.appState.value.style,
    })
  }
  return newElement(tool as 'rectangle' | 'diamond' | 'ellipse', {
    x: at.x,
    y: at.y,
    style: ctx.appState.value.style,
    roundness: ctx.appState.value.shapeRoundness,
  })
}

function eraseAlong(from: Point, to: Point) {
  const hits = elementsUnderEraser(ctx.elements.value, from, to, ctx.viewport.value.zoom)
  if (hits.length > 0) {
    ctx.doc.deleteElements(hits.map((el) => el.id))
  }
}

// ---------------------------------------------------------------------------
// Multi-point line/arrow drafting
// ---------------------------------------------------------------------------

/**
 * Beyond this many scene px from the last committed point, a press commits
 * the temp point and starts a fresh one; inside it, a press retreats the
 * temp (Excalidraw's LINE_CONFIRM_THRESHOLD).
 */
const LINE_CONFIRM_THRESHOLD = 8

/**
 * A press in the live multi-point draft — Excalidraw's multiElement flow:
 *   — no temp yet: a press beyond the threshold spins one up; inside the
 *     zone the press is swallowed (the cursor sits on the committed tip);
 *   — temp live: a press beyond the threshold commits it and pushes a new
 *     temp at the press; a press back inside the zone retreats (pops the
 *     temp), which is also how a double-click's second press unwinds it.
 */
function appendDraftPoint(at: Point): void {
  const draft = interaction.value
  if (draft.kind !== 'draftingLinear') {
    return
  }
  const el = ctx.doc.getElement(draft.elementId)
  if (!el || !isLinearElement(el)) {
    interaction.value = { kind: 'none' }
    return
  }
  const local = localPointOf(el, at)
  const points = el.points.map((point) => ({ ...point }))
  const lastCommitted = points[draft.committedCount - 1]
  if (!lastCommitted) {
    return
  }
  const distance = Math.hypot(at.x - (el.x + lastCommitted.x), at.y - (el.y + lastCommitted.y))
  if (points.length === draft.committedCount) {
    // No temp: beyond the threshold a fresh temp starts following.
    if (distance >= LINE_CONFIRM_THRESHOLD) {
      points.push({ ...local })
      ctx.doc.forceUpdateElement(el.id, pointsPatch(el, points))
    }
    return
  }
  if (distance < LINE_CONFIRM_THRESHOLD) {
    // Retreat — but never below the first committed point plus one.
    if (points.length > 2) {
      ctx.doc.forceUpdateElement(el.id, pointsPatch(el, points.slice(0, -1)))
    }
    return
  }
  // Commit the temp where it parks and let a fresh temp follow the press.
  points.push({ ...local })
  interaction.value = {
    kind: 'draftingLinear',
    elementId: el.id,
    committedCount: draft.committedCount + 1,
  }
  ctx.doc.forceUpdateElement(el.id, pointsPatch(el, points))
  // Binding feedback for the tip that just parked.
  const shape = bindableShapeAt(
    ctx.elements.value,
    at,
    maxBindingDistance(ctx.viewport.value.zoom),
    el.id,
  )
  bindingCandidates.value = shape ? [shape] : []
}

/**
 * Close the multi-point draft: the trailing temp is dropped, the remaining
 * polyline docks its tips like a fresh creation, and the step commits (or
 * cancels when fewer than two points remain).
 */
function finishLinearDraft(): void {
  const draft = interaction.value
  if (draft.kind !== 'draftingLinear') {
    return
  }
  interaction.value = { kind: 'none' }
  bindingCandidates.value = []
  const el = ctx.doc.getElement(draft.elementId)
  if (!el || !isLinearElement(el)) {
    return
  }
  const points = el.points.map((point) => ({ ...point }))
  // A live temp follows the cursor; a retreat may have popped it already
  // (the second press of a double-click does exactly that).
  if (points.length === draft.committedCount + 1) {
    points.pop()
  }
  if (points.length < 2) {
    ctx.doc.cancelStep()
    return
  }
  ctx.doc.forceUpdateElement(el.id, pointsPatch(el, points))
  const binding = computeLinearBindings(
    { ...el, points },
    ctx.elements.value,
    maxBindingDistance(ctx.viewport.value.zoom),
  )
  if (binding) {
    ctx.doc.updateElement(el.id, binding)
  }
  ctx.doc.endStep()
  ctx.select(el.id)
  ctx.setActiveTool('selection')
}

// ---------------------------------------------------------------------------
// Text creation & editing
// ---------------------------------------------------------------------------

function createTextAt(point: Point) {
  const style = ctx.appState.value
  const fontSize = style.textStyle.fontSize
  const element = newTextElement({
    x: point.x,
    y: point.y - fontSize * 1.25 * 0.5,
    style: style.style,
    text: '',
    textStyle: style.textStyle,
  })
  ctx.doc.beginStep()
  ctx.doc.addElement(element)
  ctx.select(element.id)
  ctx.setActiveTool('selection')
  ctx.setEditing(element.id)
}

function onDoubleClick(event: MouseEvent) {
  if (interaction.value.kind === 'draftingLinear') {
    // The second press of a double-click appended its point already; the
    // dedup pass on its pointerup removed it. Finish here.
    finishLinearDraft()
    return
  }
  if (ctx.activeTool.value !== 'selection') {
    return
  }
  // A pointerdown may have opened a "moving" step; discard it — the click
  // was really a double-click.
  if (interaction.value.kind === 'moving') {
    ctx.doc.cancelStep()
    interaction.value = { kind: 'none' }
  }
  const scenePoint = toScene(event)
  const hit = findElementAt(
    ctx.elements.value,
    scenePoint,
    hitThreshold(ctx.viewport.value.zoom),
  )
  if (hit && hit.type === 'text') {
    ctx.doc.beginStep()
    ctx.setEditing(hit.id)
    return
  }
  if (!hit) {
    createTextAt(scenePoint)
  }
}

// ---------------------------------------------------------------------------
// Wheel: zoom (ctrl/cmd), pan (plain / shift-horizontal)
// ---------------------------------------------------------------------------

/**
 * One ctrl/cmd+wheel zoom step, in zoom units — Excalidraw's ZOOM_STEP
 * (packages/common/src/constants.ts:365). Wheel ticks clamp their delta to
 * this step so a single mouse notch moves one step, while a trackpad
 * pinch's small ticks land per-tick.
 */
const WHEEL_ZOOM_STEP = 0.1

function onWheel(event: WheelEvent) {
  event.preventDefault()
  const host = hostRef.value
  if (!host) {
    return
  }
  const rect = host.getBoundingClientRect()
  const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }

  if (event.ctrlKey || event.metaKey) {
    // Excalidraw parity (App.wheel.ts `zoomBy`): the delta clamps to one
    // step, the zoom moves linearly by it, and a small trackpad delta gets
    // amplified by how far past 100% the canvas already is — so a wheel
    // notch is a fixed step and a pinch accelerates smoothly. zoomAt
    // anchors the new zoom at the cursor and clamps to [MIN_ZOOM, MAX_ZOOM].
    const sign = Math.sign(event.deltaY)
    const absDelta = Math.abs(event.deltaY)
    const maxStep = WHEEL_ZOOM_STEP * 100
    const delta = absDelta > maxStep ? maxStep * sign : event.deltaY
    const zoom = ctx.viewport.value.zoom
    let nextZoom = zoom - delta / 100
    nextZoom += Math.log10(Math.max(1, zoom)) * -sign * Math.min(1, absDelta / 20)
    ctx.zoomAt(screenPoint, nextZoom)
    return
  }
  if (event.shiftKey) {
    ctx.panBy(-event.deltaY, 0)
    return
  }
  ctx.panBy(0, -event.deltaY)
}

// ---------------------------------------------------------------------------
// Image insertion: drag-and-drop & clipboard paste
// ---------------------------------------------------------------------------

function onDrop(event: DragEvent): void {
  const files = event.dataTransfer?.files
  if (!files || files.length === 0) {
    return
  }
  const images = Array.from(files).filter(isImageFile)
  if (images.length === 0) {
    return
  }
  ctx.insertImageFiles(images, toScene(event))
}

function onPaste(event: ClipboardEvent): void {
  if (ctx.editingId.value) {
    return
  }
  const files = event.clipboardData?.files
  if (!files) {
    return
  }
  const images = Array.from(files).filter(isImageFile)
  if (images.length === 0) {
    return
  }
  event.preventDefault()
  // No pointer position exists for a paste — the visible canvas center is
  // the natural landing spot.
  const size = canvasSize.value
  ctx.insertImageFiles(images, screenToScene({ x: size.width / 2, y: size.height / 2 }, ctx.viewport.value))
}

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

const TOOL_SHORTCUTS: Record<string, string> = {
  '1': 'selection',
  h: 'hand',
  '2': 'rectangle',
  '3': 'diamond',
  '4': 'ellipse',
  '5': 'arrow',
  '6': 'line',
  p: 'freedraw',
  t: 'text',
  '9': 'image',
  e: 'eraser',
  f: 'frame',
  k: 'laser',
}

const NUDGE_STEP = 2
const NUDGE_STEP_LARGE = 20

function onKeyDown(event: KeyboardEvent) {
  // The text editor handles its own keys.
  if (ctx.editingId.value) {
    return
  }
  if (event.code === 'Space') {
    if (!spaceDown.value) {
      spaceDown.value = true
      event.preventDefault()
    }
    return
  }
  const mod = event.metaKey || event.ctrlKey
  const key = event.key.toLowerCase()

  if (mod && key === 'z') {
    event.preventDefault()
    if (event.shiftKey) {
      ctx.redo()
    } else {
      ctx.undo()
    }
    return
  }
  if (mod && key === 'y') {
    event.preventDefault()
    ctx.redo()
    return
  }
  if (mod && key === 'a') {
    event.preventDefault()
    ctx.selectAll()
    return
  }
  if (mod && key === 'd') {
    event.preventDefault()
    ctx.duplicateSelection()
    return
  }
  if (mod && key === 'x') {
    event.preventDefault()
    ctx.cutSelection()
    return
  }
  if (mod && key === 'c') {
    event.preventDefault()
    ctx.copySelection()
    return
  }
  if (mod && key === 'v') {
    event.preventDefault()
    ctx.paste()
    return
  }
  if (event.key === 'Escape') {
    // Escape ends a multi-point draft first; otherwise it drops selection.
    if (interaction.value.kind === 'draftingLinear') {
      finishLinearDraft()
      return
    }
    ctx.select(null)
    return
  }
  if (event.key === 'Enter' && interaction.value.kind === 'draftingLinear') {
    finishLinearDraft()
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    ctx.deleteSelection()
    return
  }

  const arrows: Record<string, Point> = {
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
  }
  const arrow = arrows[event.key]
  if (arrow && ctx.selectedElements.value.length > 0) {
    event.preventDefault()
    // With a grid on, nudging steps one cell at a time.
    const step = ctx.gridSize.value ?? (event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP)
    const delta = { x: arrow.x * step, y: arrow.y * step }
    const patches = moveElements(ctx.selectedElements.value, delta)
    for (const { id, patch } of patches) {
      // The selection mixes element kinds, so patches are base-union typed.
      ctx.doc.updateElement<VueDrawElement>(id, patch)
    }
    return
  }

  if (!mod && TOOL_SHORTCUTS[key]) {
    if (interaction.value.kind === 'draftingLinear') {
      finishLinearDraft()
    }
    const tool = TOOL_SHORTCUTS[key]! as ToolId
    // The image "tool" is an insertion gesture: pressing 9 opens the picker
    // rather than parking the app in a mode, matching the toolbar button.
    if (tool === 'image') {
      ctx.openImagePicker()
      return
    }
    ctx.setActiveTool(tool)
    return
  }

  if (!mod && (event.key === '[' || event.key === ']')) {
    if (ctx.selectedElements.value.length > 0) {
      ctx.reorderSelection(event.key === ']' ? 'forward' : 'backward')
    }
  }
}

function onKeyDownGlobal(event: KeyboardEvent) {
  if (event.code === 'Space' && !ctx.editingId.value) {
    spaceDown.value = true
  }
}

function onKeyUp(event: KeyboardEvent) {
  if (event.code === 'Space') {
    spaceDown.value = false
  }
}

onMounted(() => {
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('keydown', onKeyDownGlobal)
  window.addEventListener('paste', onPaste)
})

// ---------------------------------------------------------------------------
// Cursor
// ---------------------------------------------------------------------------

/**
 * Screen-px slack around the selection frame that still grabs (moves) the
 * selection — Excalidraw sums its collision threshold (≈8px) and handle
 * spacing (4px) into roughly this padding.
 */
const SELECTION_GRAB_PADDING = 12

/**
 * The side a border press grabs for a resize, honoring Excalidraw's
 * exclusion: a lone two-point linear never side-resizes.
 */
function sideGrabAt(point: Point, frame: SelectionFrame, zoom: number): HandleDirection | null {
  const selected = ctx.selectedElements.value
  const only = selected.length === 1 ? selected[0] : null
  if (
    only &&
    (only.type === 'line' || only.type === 'arrow') &&
    only.points.length <= 2
  ) {
    return null
  }
  return sideHandleAt(frame, point, zoom)
}

/** The lone selected, unlocked line/arrow — or null. */
function loneSelectedLinear(): VueDrawLinearElement | null {
  const selected = ctx.selectedElements.value
  const only = selected.length === 1 ? selected[0] : null
  return only && !only.locked && isLinearElement(only) ? only : null
}

/** Both-end probe results, deduped — a drag from a shape onto itself outlines it once. */
function mergeBindingCandidates(
  shapes: ReadonlyArray<VueDrawBindableShape | null>,
): readonly VueDrawBindableShape[] {
  const merged: VueDrawBindableShape[] = []
  const seen = new Set<string>()
  for (const shape of shapes) {
    if (shape && !seen.has(shape.id)) {
      seen.add(shape.id)
      merged.push(shape)
    }
  }
  return merged
}

/**
 * Idle pointer: feeds the hover cursor and, with a line/arrow tool,
 * outlines the shape a drag would bind to before the drag even starts.
 */
function handleIdleHover(scenePoint: Point): void {
  hoverScene.value = scenePoint
  const tool = ctx.activeTool.value
  if (tool === 'line' || tool === 'arrow') {
    const shape = bindableShapeAt(
      ctx.elements.value,
      scenePoint,
      maxBindingDistance(ctx.viewport.value.zoom),
    )
    bindingCandidates.value = shape ? [shape] : []
  } else if (bindingCandidates.value.length > 0) {
    bindingCandidates.value = []
  }
}

function onPointerLeave(): void {
  // Mid-gesture the capture owns the pointer; only an idle leave clears.
  if (interaction.value.kind === 'none') {
    hoverScene.value = null
    bindingCandidates.value = []
  }
}

const cursor = computed(() => {
  const active = interaction.value
  if (active.kind === 'panning' || active.kind === 'rotating') {
    return 'grabbing'
  }
  if (active.kind === 'resizing') {
    const angle = selectionFrameOf(ctx.selectedElements.value)?.angle ?? 0
    return resizeCursorFor(active.handle, angle)
  }
  if (active.kind === 'moving' || active.kind === 'movingPoint') {
    return 'move'
  }
  const tool = ctx.activeTool.value
  if (tool === 'hand') {
    return 'grab'
  }
  if (tool === 'selection') {
    if (spaceDown.value) {
      return 'grab'
    }
    const point = hoverScene.value
    if (!point) {
      return 'default'
    }
    const zoom = ctx.viewport.value.zoom
    const frame = selectionFrameOf(ctx.selectedElements.value)
    if (frame) {
      // Point handles advertise a point drag before the box chrome does.
      const loneLinear = loneSelectedLinear()
      if (loneLinear) {
        const mid = linearMidpointHandle(loneLinear)
        if (
          linearHandleAt(linearPointHandles(loneLinear), point, zoom) ||
          (mid && linearHandleAt([mid], point, zoom))
        ) {
          return 'move'
        }
      }
      // What a press here would do, top to bottom: a transform handle,
      // a border side, then a grab of the selection itself.
      const handle = handleAt(handleLayout.value, point)
      if (handle) {
        return resizeCursorFor(handle, frame.angle)
      }
      const side = sideGrabAt(point, frame, zoom)
      if (side) {
        return resizeCursorFor(side, frame.angle)
      }
      if (pointInSelectionFrame(frame, point, SELECTION_GRAB_PADDING / zoom)) {
        return 'move'
      }
    }
    const hit = findElementAt(ctx.elements.value, point, hitThreshold(zoom))
    return hit && !hit.locked ? 'move' : 'default'
  }
  if (tool === 'text') {
    const point = hoverScene.value
    const hit = point
      ? findElementAt(ctx.elements.value, point, hitThreshold(ctx.viewport.value.zoom))
      : null
    return hit?.type === 'text' ? 'text' : 'crosshair'
  }
  return 'crosshair'
})
</script>

<template>
  <div
    ref="hostRef"
    class="vuedraw-canvas"
    :class="{ 'vuedraw-canvas--panning': interaction.kind === 'panning' }"
    :style="{ cursor }"
    tabindex="0"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @pointerleave="onPointerLeave"
    @mousedown="onMouseDown"
    @wheel="onWheel"
    @dblclick="onDoubleClick"
    @keydown="onKeyDown"
    @contextmenu.prevent="emit('contextmenu', { x: $event.clientX, y: $event.clientY })"
    @dragover.prevent
    @drop.prevent="onDrop"
  >
    <canvas ref="staticRef" class="vuedraw-canvas__static" />
    <canvas ref="overlayRef" class="vuedraw-canvas__overlay" />
    <TextEditor v-if="editingActive" />
  </div>
</template>

<style scoped>
.vuedraw-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  outline: none;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.vuedraw-canvas__static,
.vuedraw-canvas__overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.vuedraw-canvas--panning {
  cursor: grabbing !important;
}
</style>
