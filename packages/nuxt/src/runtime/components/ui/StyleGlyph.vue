<script lang="ts">
/** The style previews the properties panel shows on its option buttons. */
export type StyleGlyphName =
  | 'fillHachure'
  | 'fillCrossHatch'
  | 'fillSolid'
  | 'strokeThin'
  | 'strokeBold'
  | 'strokeExtraBold'
  | 'strokeSolid'
  | 'strokeDashed'
  | 'strokeDotted'
  | 'sloppinessArchitect'
  | 'sloppinessArtist'
  | 'sloppinessCartoonist'
  | 'edgeSharp'
  | 'edgeRound'
  | 'arrowSharp'
  | 'arrowRound'
  | 'arrowElbow'
</script>

<script setup lang="ts">
import { computed, useId } from 'vue'

import { ARROW_TYPE_OPTIONS } from '@opendraw/editor'

/**
 * StyleGlyph — a drawing of a style value (a hatched square, a dashed line,
 * a rough stroke), not an icon: Lucide has no glyph for "this fill" or
 * "this sloppiness", and these previews are what tell the options apart.
 * Paths are Excalidraw's own (components/icons.tsx, MIT), so the panel
 * reads exactly like Excalidraw's.
 */
const props = withDefaults(defineProps<{ name: StyleGlyphName; size?: number }>(), { size: 16 })

const clipId = `od-glyph-${useId()}`

/** The arrow-type glyphs come from the editor's shared definitions (24×24 grid). */
const ARROW_GLYPHS = { arrowSharp: 'sharp', arrowRound: 'round', arrowElbow: 'elbow' } as const
const arrowPaths = computed(() => {
  const type = ARROW_GLYPHS[props.name as keyof typeof ARROW_GLYPHS]
  return type ? (ARROW_TYPE_OPTIONS.find((option) => option.type === type)?.paths ?? null) : null
})
const SQUARE =
  'M5.879 2.625h8.242a3.254 3.254 0 0 1 3.254 3.254v8.242a3.254 3.254 0 0 1-3.254 3.254H5.88a3.254 3.254 0 0 1-3.254-3.254V5.88a3.254 3.254 0 0 1 3.254-3.254Z'
</script>

<template>
  <svg
    v-if="arrowPaths"
    class="style-glyph"
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="d in arrowPaths" :key="d" :d="d" />
  </svg>
  <svg
    v-else
    class="style-glyph"
    :width="props.size"
    :height="props.size"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="props.name === 'fillHachure' || props.name === 'fillCrossHatch'">
      <defs>
        <clipPath :id="clipId"><path :d="SQUARE" /></clipPath>
      </defs>
      <path :d="SQUARE" stroke-width="1.25" />
      <g :clip-path="`url(#${clipId})`" stroke-width="1.25">
        <path d="M2.258 15.156 15.156 2.258M7.324 20.222 20.222 7.325m-20.444 5.35L12.675-.222m-8.157 18.34L17.416 5.22" />
        <path
          v-if="props.name === 'fillCrossHatch'"
          d="M15.045 17.574 2.426 4.956M20 12.617 7.383 0m5.234 20L0 7.383m17.941 7.98L5.324 2.745"
        />
      </g>
    </template>
    <path
      v-else-if="props.name === 'fillSolid'"
      d="M4.91 2.625h10.18a2.284 2.284 0 0 1 2.285 2.284v10.182a2.284 2.284 0 0 1-2.284 2.284H4.909a2.284 2.284 0 0 1-2.284-2.284V4.909a2.284 2.284 0 0 1 2.284-2.284Z"
      fill="currentColor"
      stroke-width="1.25"
    />
    <path v-else-if="props.name === 'strokeThin'" d="M4.167 10h11.666" stroke-width="1.25" />
    <path v-else-if="props.name === 'strokeBold'" d="M5 10h10" stroke-width="2.5" />
    <path v-else-if="props.name === 'strokeExtraBold'" d="M5 10h10" stroke-width="3.75" />
    <path v-else-if="props.name === 'strokeSolid'" d="M3 10h14" stroke-width="1.75" />
    <path v-else-if="props.name === 'strokeDashed'" d="M3 10h2.5M8.75 10h2.5M14.5 10h2.5" stroke-width="1.75" />
    <path v-else-if="props.name === 'strokeDotted'" d="M3.3 10v.01M6.65 10v.01M10 10v.01M13.35 10v.01M16.7 10v.01" stroke-width="1.75" />
    <path
      v-else-if="props.name === 'sloppinessArchitect'"
      d="M2.5 12.038c1.655-.885 5.9-3.292 8.568-4.354 2.668-1.063.101 2.821 1.32 3.104 1.218.283 5.112-1.814 5.112-1.814"
      stroke-width="1.25"
    />
    <path
      v-else-if="props.name === 'sloppinessArtist'"
      d="M2.5 12.563c1.655-.886 5.9-3.293 8.568-4.355 2.668-1.062.101 2.822 1.32 3.105 1.218.283 5.112-1.814 5.112-1.814m-13.469 2.23c2.963-1.586 6.13-5.62 7.468-4.998 1.338.623-1.153 4.11-.132 5.595 1.02 1.487 6.133-1.43 6.133-1.43"
      stroke-width="1.25"
    />
    <path
      v-else-if="props.name === 'sloppinessCartoonist'"
      d="M2.5 11.936c1.737-.879 8.627-5.346 10.42-5.268 1.795.078-.418 5.138.345 5.736.763.598 3.53-1.789 4.235-2.147M2.929 9.788c1.164-.519 5.47-3.28 6.987-3.114 1.519.165 1 3.827 2.121 4.109 1.122.281 3.839-2.016 4.606-2.42"
      stroke-width="1.25"
    />
    <g v-else-if="props.name === 'edgeSharp'" stroke-width="1.5">
      <path d="M3.333 10V3.336C4.952 3.334 6.063 3.333 6.667 3.333H10" />
      <path d="M13.333 3.333v.01M16.667 3.333v.01M16.667 6.667v.01M16.667 10v.01M3.333 13.333v.01M16.667 13.333v.01M3.333 16.667v.01M6.667 16.667v.01M10 16.667v.01M13.333 16.667v.01M16.667 16.667v.01" />
    </g>
    <g v-else-if="props.name === 'edgeRound'" stroke-width="1.5">
      <path d="M3.333 10V6.667a3.333 3.333 0 0 1 3.334-3.334H10" />
      <path d="M13.333 3.333v.01M16.667 3.333v.01M16.667 6.667v.01M16.667 10v.01M3.333 13.333v.01M16.667 13.333v.01M3.333 16.667v.01M6.667 16.667v.01M10 16.667v.01M13.333 16.667v.01M16.667 16.667v.01" />
    </g>
  </svg>
</template>

<style scoped>
.style-glyph {
  display: block;
  flex-shrink: 0;
}
</style>
