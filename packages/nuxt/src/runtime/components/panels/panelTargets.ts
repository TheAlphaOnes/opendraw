import type { ElementType, ToolId, VueDrawElement } from '@vuedraw/core'

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
  strokeShape: false,
  sloppiness: false,
  corners: false,
  arrowheads: false,
  text: false,
}

/** Tools whose next element the island can pre-style. */
const STYLED_TOOLS: ReadonlySet<ToolId> = new Set([
  'rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw', 'text', 'frame',
])

const FILLABLE: ReadonlySet<ElementType> = new Set(['rectangle', 'diamond', 'ellipse', 'line', 'freedraw'])
const STROKE_SHAPED: ReadonlySet<ElementType> = new Set(['rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw'])
const SLOPPY: ReadonlySet<ElementType> = new Set(['rectangle', 'diamond', 'ellipse', 'arrow', 'line'])
const CORNERED: ReadonlySet<ElementType> = new Set(['rectangle', 'diamond'])
/** Images carry no ink of their own — only opacity applies. */
const INKED: ReadonlySet<ElementType> = new Set([
  'rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw', 'text', 'frame',
])

export function panelTargets(selected: readonly VueDrawElement[], tool: ToolId): PanelTargets {
  let types: ElementType[]
  if (selected.length > 0) {
    types = [...new Set(selected.map((el) => el.type))]
  } else if (STYLED_TOOLS.has(tool)) {
    types = [tool as ElementType]
  } else {
    return HIDDEN
  }
  const any = (set: ReadonlySet<ElementType>): boolean => types.some((type) => set.has(type))
  return {
    visible: true,
    stroke: any(INKED),
    background: any(FILLABLE),
    strokeShape: any(STROKE_SHAPED),
    sloppiness: any(SLOPPY),
    corners: any(CORNERED),
    arrowheads: types.includes('arrow'),
    text: types.includes('text'),
  }
}
