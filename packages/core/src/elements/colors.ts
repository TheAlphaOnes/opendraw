/**
 * The color picker's palette and helpers — a port of Excalidraw's
 * common/src/colors.ts and ColorPicker/colorPickerUtils.ts. The palette is
 * a 5×3 grid of base colors (each with five shades where it has them),
 * picked by the q-w-e-r-t / a-s-d-f-g / z-x-c-v-b hotkeys.
 */

import { parseColor } from '../render/theme.js'
import type { OpenDrawElement } from '../types.js'

/** Open-color shades at weights 50, 200, 400, 600, 800 (Excalidraw's COLOR_PALETTE). */
export const COLOR_PALETTE = {
  transparent: 'transparent',
  black: '#1e1e1e',
  white: '#ffffff',
  gray: ['#f8f9fa', '#e9ecef', '#ced4da', '#868e96', '#343a40'],
  red: ['#fff5f5', '#ffc9c9', '#ff8787', '#fa5252', '#e03131'],
  pink: ['#fff0f6', '#fcc2d7', '#f783ac', '#e64980', '#c2255c'],
  grape: ['#f8f0fc', '#eebefa', '#da77f2', '#be4bdb', '#9c36b5'],
  violet: ['#f3f0ff', '#d0bfff', '#9775fa', '#7950f2', '#6741d9'],
  blue: ['#e7f5ff', '#a5d8ff', '#4dabf7', '#228be6', '#1971c2'],
  cyan: ['#e3fafc', '#99e9f2', '#3bc9db', '#15aabf', '#0c8599'],
  teal: ['#e6fcf5', '#96f2d7', '#38d9a9', '#12b886', '#099268'],
  green: ['#ebfbee', '#b2f2bb', '#69db7c', '#40c057', '#2f9e44'],
  yellow: ['#fff9db', '#ffec99', '#ffd43b', '#fab005', '#f08c00'],
  orange: ['#fff4e6', '#ffd8a8', '#ffa94d', '#fd7e14', '#e8590c'],
  bronze: ['#f8f1ee', '#eaddd7', '#d2bab0', '#a18072', '#846358'],
} as const

export type ColorName = keyof typeof COLOR_PALETTE
/** A palette entry: one fixed color, or its five shades. */
export type PaletteEntry = string | readonly string[]
export type ColorPalette = Readonly<Record<string, PaletteEntry>>

/**
 * The picker grid, row by row (DEFAULT_ELEMENT_STROKE_COLOR_PALETTE —
 * Excalidraw uses the same grid for strokes and backgrounds).
 */
export const ELEMENT_COLOR_PALETTE: ColorPalette = {
  transparent: COLOR_PALETTE.transparent,
  white: COLOR_PALETTE.white,
  gray: COLOR_PALETTE.gray,
  black: COLOR_PALETTE.black,
  bronze: COLOR_PALETTE.bronze,
  cyan: COLOR_PALETTE.cyan,
  blue: COLOR_PALETTE.blue,
  violet: COLOR_PALETTE.violet,
  grape: COLOR_PALETTE.grape,
  pink: COLOR_PALETTE.pink,
  green: COLOR_PALETTE.green,
  teal: COLOR_PALETTE.teal,
  yellow: COLOR_PALETTE.yellow,
  orange: COLOR_PALETTE.orange,
  red: COLOR_PALETTE.red,
}

/** The shade a base-color pick lands on when the current color has none. */
export const DEFAULT_STROKE_SHADE = 4
export const DEFAULT_BACKGROUND_SHADE = 1
export const COLORS_PER_ROW = 5
export const MAX_CUSTOM_COLORS = 5

/** One hotkey per grid cell, in grid order. */
export const COLOR_PICKER_HOTKEYS: readonly string[] = [
  ['q', 'w', 'e', 'r', 't'],
  ['a', 's', 'd', 'f', 'g'],
  ['z', 'x', 'c', 'v', 'b'],
].flat()

/** Where a color sits in the palette: its base color and shade (null for fixed colors). */
export function colorNameAndShade(
  palette: ColorPalette,
  color: string | null,
): { name: string; shade: number | null } | null {
  if (!color) {
    return null
  }
  for (const [name, entry] of Object.entries(palette)) {
    if (typeof entry === 'string') {
      if (entry === color) {
        return { name, shade: null }
      }
    } else {
      const shade = entry.indexOf(color)
      if (shade > -1) {
        return { name, shade }
      }
    }
  }
  return null
}

/** The color a grid cell shows at the given shade. */
export function paletteColorAt(entry: PaletteEntry, shade: number): string {
  return typeof entry === 'string' ? entry : (entry[shade] ?? entry[0]!)
}

export function isCustomColor(palette: ColorPalette, color: string): boolean {
  return !Object.values(palette).flat().includes(color)
}

/** Canvas colors outside the palette, most used first (getMostUsedCustomColors). */
export function mostUsedCustomColors(
  elements: readonly OpenDrawElement[],
  property: 'strokeColor' | 'backgroundColor',
  palette: ColorPalette = ELEMENT_COLOR_PALETTE,
): string[] {
  const counts = new Map<string, number>()
  for (const el of elements) {
    const color = el[property]
    if (color !== 'transparent' && isCustomColor(palette, color)) {
      counts.set(color, (counts.get(color) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([color]) => color)
    .slice(0, MAX_CUSTOM_COLORS)
}

/**
 * A typed color made usable, or null when it is not one: `transparent`,
 * hex with or without `#` (3, 4, 6 or 8 digits) and rgb()/rgba().
 */
export function normalizeInputColor(input: string): string | null {
  const color = input.trim().toLowerCase()
  if (color === 'transparent') {
    return color
  }
  if (/^[0-9a-f]+$/.test(color)) {
    return parseColor(`#${color}`) ? `#${color}` : null
  }
  return parseColor(color) ? color : null
}

/**
 * Why a typed color was rejected — Excalidraw's two messages — or null
 * when it is fine (or empty).
 */
export function inputColorError(input: string): string | null {
  const value = input.trim().toLowerCase()
  if (value === '' || normalizeInputColor(value)) {
    return null
  }
  return /^#?[0-9a-f]+$/.test(value) ? 'Hex code must be 3, 4, 6, or 8 characters' : 'Not a valid color'
}

/** Excalidraw's outline threshold: lighter swatches get a hairline ring. */
export const COLOR_OUTLINE_CONTRAST_THRESHOLD = 240

/** YIQ brightness below the threshold (isColorDark); transparent is light. */
export function isColorDark(color: string, threshold = 160): boolean {
  if (!color) {
    return true
  }
  if (color === 'transparent') {
    return false
  }
  const rgba = parseColor(color)
  if (!rgba) {
    return true
  }
  return (rgba.r * 299 + rgba.g * 587 + rgba.b * 114) / 1000 < threshold
}

/** Display name of a palette entry ("blue" → "Blue"). */
export function colorLabel(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}
