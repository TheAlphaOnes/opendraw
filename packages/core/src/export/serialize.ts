/**
 * Scene file (de)serialization with defensive parsing.
 *
 * Files carry a version and the elements verbatim. Parsing coerces unknown
 * input into valid elements, dropping anything malformed instead of
 * throwing mid-restore — a corrupted third-party file must not take the
 * editor down with it.
 */

import { isElementType } from '../elements/factories.js'
import type {
  FillStyle,
  Opacity,
  Roughness,
  StrokeStyle,
  StrokeWidth,
  TextAlign,
  VueDrawArrowBinding,
  VueDrawElement,
  VueDrawFile,
} from '../types.js'

const FILL_STYLES: readonly FillStyle[] = ['hachure', 'cross-hatch', 'solid']
const STROKE_STYLES: readonly StrokeStyle[] = ['solid', 'dashed', 'dotted']
const STROKE_WIDTHS: readonly StrokeWidth[] = [1, 2, 4]
const ROUGHNESS_LEVELS: readonly Roughness[] = [0, 1, 2]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function oneOf<T extends string | number>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function points(value: unknown): Array<{ x: number; y: number }> {
  if (!Array.isArray(value)) {
    return [{ x: 0, y: 0 }]
  }
  return value
    .filter((p): p is Record<string, unknown> => isRecord(p))
    .map((p) => ({ x: num(p.x, 0), y: num(p.y, 0) }))
}

function freedrawPoints(value: unknown): number[][] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((p): p is unknown[] => Array.isArray(p))
    .map((p) => [num(p[0], 0), num(p[1], 0), num(p[2], 0.5)])
}

/** Coerces an arrow tip binding: a record with a string elementId, else null. */
function arrowBinding(value: unknown): VueDrawArrowBinding | null {
  if (!isRecord(value) || typeof value.elementId !== 'string') {
    return null
  }
  return { elementId: value.elementId }
}

/**
 * Coerces unknown data into a valid element, or null when it isn't one.
 * Unknown props are dropped; invalid values fall back to defaults.
 */
export function coerceElement(input: unknown): VueDrawElement | null {
  if (!isRecord(input) || typeof input.id !== 'string' || !isElementType(String(input.type))) {
    return null
  }
  const type = input.type as VueDrawElement['type']
  const base = {
    id: input.id,
    type,
    x: num(input.x, 0),
    y: num(input.y, 0),
    width: num(input.width, 0),
    height: num(input.height, 0),
    angle: num(input.angle, 0),
    strokeColor: str(input.strokeColor, '#1e1e1e'),
    backgroundColor: str(input.backgroundColor, 'transparent'),
    fillStyle: oneOf<FillStyle>(input.fillStyle, FILL_STYLES, 'hachure'),
    strokeWidth: oneOf<StrokeWidth>(input.strokeWidth, STROKE_WIDTHS, 2),
    strokeStyle: oneOf<StrokeStyle>(input.strokeStyle, STROKE_STYLES, 'solid'),
    roughness: oneOf<Roughness>(input.roughness, ROUGHNESS_LEVELS, 1),
    opacity: Math.max(0, Math.min(100, num(input.opacity, 100))) as Opacity,
    seed: num(input.seed, 1),
    version: Math.max(1, num(input.version, 1)),
    versionNonce: str(input.versionNonce, ''),
    locked: input.locked === true,
  }
  if (type === 'line') {
    return { ...base, type, points: points(input.points) }
  }
  if (type === 'arrow') {
    return {
      ...base,
      type,
      points: points(input.points),
      startBinding: arrowBinding(input.startBinding),
      endBinding: arrowBinding(input.endBinding),
    }
  }
  if (type === 'freedraw') {
    return { ...base, type, points: freedrawPoints(input.points), simulatePressure: input.simulatePressure !== false }
  }
  if (type === 'text') {
    return {
      ...base,
      type,
      text: str(input.text, ''),
      fontSize: Math.max(8, num(input.fontSize, 20)),
      fontFamily: oneOf(input.fontFamily, ['hand', 'normal', 'code'] as const, 'hand'),
      textAlign: oneOf<TextAlign>(input.textAlign, ['left', 'center', 'right'] as const, 'left'),
      verticalAlign: oneOf(input.verticalAlign, ['top', 'middle', 'bottom'] as const, 'top'),
      lineHeight: num(input.lineHeight, 1.25),
    }
  }
  return { ...base, type: type as 'rectangle' | 'diamond' | 'ellipse' }
}

/** Builds a scene file from elements (+ document background). */
export function buildFile(
  elements: readonly VueDrawElement[],
  viewBackgroundColor: string,
): VueDrawFile {
  return {
    type: 'vuedraw',
    version: 1,
    elements: elements.map((el) => ({ ...el })),
    appState: { viewBackgroundColor },
  }
}

/**
 * Parses unknown input as a vuedraw file. Throws only for clearly-wrong
 * payloads (not our file type); malformed elements are dropped.
 */
export function parseFile(input: unknown): VueDrawFile {
  if (!isRecord(input) || input.type !== 'vuedraw') {
    throw new Error('not a vuedraw file (missing type: "vuedraw")')
  }
  const rawElements = Array.isArray(input.elements) ? input.elements : []
  const elements = rawElements
    .map((el) => coerceElement(el))
    .filter((el): el is VueDrawElement => el !== null)
  const appState = isRecord(input.appState) ? input.appState : {}
  return {
    type: 'vuedraw',
    version: 1,
    elements,
    appState: {
      viewBackgroundColor: str(appState.viewBackgroundColor, '#ffffff'),
    },
  }
}

export function serializeToJSON(file: VueDrawFile): string {
  return JSON.stringify(file, null, 2)
}

export function parseFromJSON(text: string): VueDrawFile {
  return parseFile(JSON.parse(text))
}
