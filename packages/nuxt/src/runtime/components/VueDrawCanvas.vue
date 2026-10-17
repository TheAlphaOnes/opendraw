<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import type {
  Bounds,
  HandleDirection,
  Point,
  ResizeHandle,
  SelectionFrame,
  VueDrawBindableShape,
  VueDrawElement,
} from '@vuedraw/core'
import {
  bindableShapeAt,
  bindingFollowPatches,
  computeLinearBindings,
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
  maxBindingDistance,
  moveElements,
  newElement,
  newFreedrawElement,
  newLinearElement,
  newTextElement,
  pointInSelectionFrame,
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
}

watch(() => ctx.state.value.rev, scheduleRender)
watch(canvasSize, scheduleRender)

onMounted(() => {
  observeSize()
  scheduleRender()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (renderFrame) {
    cancelAnimationFrame(renderFrame)
  }
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('keydown', onKeyDownGlobal)
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
  | { kind: 'erasing' }

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
const SHAPE_TOOLS = new Set(['rectangle', 'diamond', 'ellipse', 'line', 'arrow'])

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

  // Text tool: create immediately and start editing.
  if (tool === 'text') {
    createTextAt(scenePoint)
    return
  }

  if (tool === 'eraser') {
    ctx.doc.beginStep()
    interaction.value = { kind: 'erasing' }
    eraseAt(scenePoint)
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
        ctx.doc.forceUpdateElement(el.id, { points })
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
      eraseAt(scenePoint)
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
          (el.type === 'rectangle' || el.type === 'diamond' || el.type === 'ellipse') &&
          el.width < 2 &&
          el.height < 2
        const emptyLine =
          (el.type === 'line' || el.type === 'arrow') &&
          (el.points.length < 2 || (el.points[1]!.x === 0 && el.points[1]!.y === 0))
        if (tooSmall || emptyLine) {
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
  return newElement(tool as 'rectangle' | 'diamond' | 'ellipse', {
    x: at.x,
    y: at.y,
    style: ctx.appState.value.style,
    roundness: ctx.appState.value.shapeRoundness,
  })
}

function eraseAt(point: Point) {
  const hits = elementsUnderEraser(ctx.elements.value, point, ctx.viewport.value.zoom)
  if (hits.length > 0) {
    ctx.doc.deleteElements(hits.map((el) => el.id))
  }
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

function onWheel(event: WheelEvent) {
  event.preventDefault()
  const host = hostRef.value
  if (!host) {
    return
  }
  const rect = host.getBoundingClientRect()
  const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }

  if (event.ctrlKey || event.metaKey) {
    const factor = Math.exp(-event.deltaY * 0.01)
    ctx.zoomAt(screenPoint, ctx.viewport.value.zoom * factor)
    return
  }
  if (event.shiftKey) {
    ctx.panBy(-event.deltaY, 0)
    return
  }
  ctx.panBy(0, -event.deltaY)
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
  e: 'eraser',
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
    ctx.select(null)
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
    ctx.setActiveTool(TOOL_SHORTCUTS[key]! as never)
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
  if (active.kind === 'moving') {
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
