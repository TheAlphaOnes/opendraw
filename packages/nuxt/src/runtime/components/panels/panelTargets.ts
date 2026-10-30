import type { ElementType, ToolId, OpenDrawElement } from '@opendraw/core'

/**
 * Which property sections the properties island shows — Excalidraw's
 * per-type predicates (hasBackground, hasStrokeWidth, hasStrokeStyle,
 * canChangeRoundness, …) applied to the selection, or to the armed tool
 * when nothing is selected.
 */
export interface PanelTargets {
  visible: boolean
  stroke: boolean
  background: boolean
  /** Fill patterns — paper (a sticky note) has a background but no fill style. */
  fill: boolean
  /** Only sticky notes: "Text color" and the note palette (their own color domain). */
  notes: boolean
  /** Stroke width + stroke style. */
  strokeShape: boolean
  sloppiness: boolean
  corners: boolean
  arrowheads: boolean
  text: boolean
}

const HIDDEN: PanelTargets = {
  visible: false,
  stroke: false,
  background: false,
  fill: false,
  notes: false,
  strokeShape: false,
  sloppiness: false,
  corners: false,
  arrowheads: false,
  text: false,
}

/** Tools whose next element the island can pre-style. */
const STYLED_TOOLS: ReadonlySet<ToolId> = new Set([
  'rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw', 'text', 'frame', 'stickynote',
])

const BACKGROUNDED: ReadonlySet<ElementType> = new Set(['rectangle', 'stickynote', 'diamond', 'ellipse', 'line', 'freedraw'])
const FILLABLE: ReadonlySet<ElementType> = new Set(['rectangle', 'diamond', 'ellipse', 'line', 'freedraw'])
const STROKE_SHAPED: ReadonlySet<ElementType> = new Set(['rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw'])
const SLOPPY: ReadonlySet<ElementType> = new Set(['rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'stickynote'])
/** Excalidraw's "Edges" control. Arrows have their own "Arrow type". */
const CORNERED: ReadonlySet<ElementType> = new Set(['rectangle', 'diamond', 'line', 'stickynote'])
/** Images carry no ink of their own — only opacity applies. */
const INKED: ReadonlySet<ElementType> = new Set([
  'rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw', 'text', 'frame', 'stickynote',
])

export function panelTargets(
  selected: readonly OpenDrawElement[],
  tool: ToolId,
  hasLabels = false,
): PanelTargets {
  let types: ElementType[]
  if (selected.length > 0) {
    types = [...new Set(selected.map((el) => el.type))]
    // A labelled shape exposes its label's text properties.
    if (hasLabels) {
      types.push('text')
    }
  } else if (STYLED_TOOLS.has(tool)) {
    types = [tool as ElementType]
  } else {
    return HIDDEN
  }
  const any = (set: ReadonlySet<ElementType>): boolean => types.some((type) => set.has(type))
  return {
    visible: true,
    stroke: any(INKED),
    background: any(BACKGROUNDED),
    fill: any(FILLABLE),
    notes: types.every((type) => type === 'stickynote' || type === 'text') && types.includes('stickynote'),
    strokeShape: any(STROKE_SHAPED),
    sloppiness: any(SLOPPY),
    corners: any(CORNERED),
    arrowheads: types.includes('arrow'),
    // A note's font size is its label's fit ceiling.
    text: types.includes('text') || types.includes('stickynote'),
  }
}
