import type { ArrowType } from '@opendrawjs/core'

/**
 * Excalidraw's "Arrow type" options with their icons (components/icons.tsx:
 * sharpArrowIcon, roundArrowIcon, elbowArrowIcon — MIT), as plain SVG path
 * data on a 24×24, 2px-stroke grid, so every adapter draws the same glyphs.
 */
export interface ArrowTypeOption {
  type: ArrowType
  label: string
  paths: readonly string[]
}

export const ARROW_TYPE_OPTIONS: readonly ArrowTypeOption[] = [
  { type: 'sharp', label: 'Sharp arrow', paths: ['M6 18l12 -12', 'M18 10v-4h-4'] },
  { type: 'round', label: 'Curved arrow', paths: ['M16 12L20 9L16 6', 'M6 20c0 -6.075 4.925 -11 11 -11h3'] },
  {
    type: 'elbow',
    label: 'Elbow arrow',
    paths: ['M4 19L10 19C11.097 19 12 18.097 12 17L12 9C12 7.903 12.903 7 14 7L21 7', 'M18 4l3 3l-3 3'],
  },
]
