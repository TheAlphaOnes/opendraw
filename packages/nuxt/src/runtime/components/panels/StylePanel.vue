<script setup lang="ts">
import { computed } from 'vue'

import {
  BACKGROUND_PALETTE,
  ROUGHNESS_LEVELS,
  STROKE_PALETTE,
  STROKE_WIDTHS,
  type ElementStyle,
  type FillStyle,
  type FontFamily,
  type Roughness,
  type StrokeStyle,
  type StrokeWidth,
  type TextAlign,
  type TextStyle,
  type VueDrawTextElement,
} from '@vuedraw/core'

import { useVueDraw } from '../../composables/useVueDraw.js'
import UiPanel from '../ui/UiPanel.vue'
import UiSegmented, { type UiSegmentedOption } from '../ui/UiSegmented.vue'
import UiSlider from '../ui/UiSlider.vue'
import UiSwatchRow from '../ui/UiSwatchRow.vue'

const ctx = useVueDraw()

/**
 * The style panel shows wherever style applies — selection mode AND armed
 * shape tools (Excalidraw keeps the property panel live so a draw can be
 * pre-styled before it starts); only the chrome-only tools hide it.
 */
const visible = computed(
  () => !(ctx.activeTool.value === 'hand' || ctx.activeTool.value === 'eraser' || ctx.activeTool.value === 'laser'),
)

// ---------------------------------------------------------------------------
// Current style: read from the first selected element, else app-state defaults.
// changeStyle/changeTextStyle write back to the same target the core chose
// (patch the selection, or update defaults when nothing is selected).
// ---------------------------------------------------------------------------

const firstSelected = computed(() => ctx.selectedElements.value[0] ?? null)

const currentStyle = computed<ElementStyle>(() => {
  const el = firstSelected.value
  if (el) {
    return {
      strokeColor: el.strokeColor,
      backgroundColor: el.backgroundColor,
      fillStyle: el.fillStyle,
      strokeWidth: el.strokeWidth,
      strokeStyle: el.strokeStyle,
      roughness: el.roughness,
      opacity: el.opacity,
    }
  }
  return { ...ctx.appState.value.style }
})

const firstText = computed(
  () => ctx.selectedElements.value.find((el): el is VueDrawTextElement => el.type === 'text') ?? null,
)

/** Corners apply to rectangles and diamonds only. */
const cornersVisible = computed(() => {
  const el = firstSelected.value
  return el === null || el.type === 'rectangle' || el.type === 'diamond'
})

/** Corner treatment of the first selected rect/diamond, else the new-shape default. */
const currentRoundness = computed(() => {
  const el = firstSelected.value
  if (el && (el.type === 'rectangle' || el.type === 'diamond')) {
    return el.roundness === 'round' ? 'round' : 'sharp'
  }
  return ctx.appState.value.shapeRoundness === 'round' ? 'round' : 'sharp'
})

/** Text controls appear while editing defaults (no selection) or when a text element is selected. */
const textSectionVisible = computed(
  () => ctx.selectedElements.value.length === 0 || firstText.value !== null,
)

const currentTextStyle = computed<TextStyle>(() => {
  const el = firstText.value
  if (el) {
    return { fontSize: el.fontSize, fontFamily: el.fontFamily, textAlign: el.textAlign }
  }
  return { ...ctx.appState.value.textStyle }
})

// ---------------------------------------------------------------------------
// Option sets and setters
// ---------------------------------------------------------------------------

const fillOptions: UiSegmentedOption[] = [
  { value: 'hachure', label: 'Hachure fill', icon: 'fillHachure' },
  { value: 'cross-hatch', label: 'Cross-hatch fill', icon: 'fillCrossHatch' },
  { value: 'solid', label: 'Solid fill', icon: 'fillSolid' },
]

// Excalidraw's naming for the 1/2/4 widths.
const strokeWidthOptions: UiSegmentedOption[] = [
  { value: String(STROKE_WIDTHS.thin), label: 'Thin stroke', icon: 'strokeThin' },
  { value: String(STROKE_WIDTHS.medium), label: 'Bold stroke', icon: 'strokeMedium' },
  { value: String(STROKE_WIDTHS.bold), label: 'Extra bold stroke', icon: 'strokeBold' },
]

const strokeStyleOptions: UiSegmentedOption[] = [
  { value: 'solid', label: 'Solid line' },
  { value: 'dashed', label: 'Dashed line' },
  { value: 'dotted', label: 'Dotted line' },
]

const roughnessOptions: UiSegmentedOption[] = [
  { value: String(ROUGHNESS_LEVELS.architect), label: 'Architect' },
  { value: String(ROUGHNESS_LEVELS.artist), label: 'Artist' },
  { value: String(ROUGHNESS_LEVELS.cartoonist), label: 'Cartoonist' },
]

const cornerOptions: UiSegmentedOption[] = [
  { value: 'sharp', label: 'Sharp corners', icon: 'cornerSharp' },
  { value: 'round', label: 'Rounded corners', icon: 'cornerRound' },
]

const fontFamilyOptions: UiSegmentedOption[] = [
  { value: 'hand', label: 'Hand-drawn font' },
  { value: 'normal', label: 'Normal font' },
  { value: 'code', label: 'Code font' },
]

const fontSizeOptions: UiSegmentedOption[] = [
  { value: '16', label: 'Small text' },
  { value: '20', label: 'Medium text' },
  { value: '28', label: 'Large text' },
]

const alignOptions: UiSegmentedOption[] = [
  { value: 'left', label: 'Align left', icon: 'alignLeft' },
  { value: 'center', label: 'Align center', icon: 'alignCenter' },
  { value: 'right', label: 'Align right', icon: 'alignRight' },
]

const setStrokeColor = (color: string): void => ctx.changeStyle({ strokeColor: color })
const setBackgroundColor = (color: string): void => ctx.changeStyle({ backgroundColor: color })
const setFill = (value: string): void => ctx.changeStyle({ fillStyle: value as FillStyle })
const setStrokeWidth = (value: string): void => ctx.changeStyle({ strokeWidth: Number(value) as StrokeWidth })
const setStrokeStyle = (value: string): void => ctx.changeStyle({ strokeStyle: value as StrokeStyle })
const setRoughness = (value: string): void => ctx.changeStyle({ roughness: Number(value) as Roughness })
const setOpacity = (value: number): void => ctx.changeStyle({ opacity: value })
const setFontFamily = (value: string): void => ctx.changeTextStyle({ fontFamily: value as FontFamily })
const setFontSize = (value: string): void => ctx.changeTextStyle({ fontSize: Number(value) })
const setTextAlign = (value: string): void => ctx.changeTextStyle({ textAlign: value as TextAlign })
const setRoundness = (value: string): void => ctx.changeRoundness(value === 'round' ? 'round' : null)

/** One descriptor per segmented section so the template stays a single loop. */
interface StyleSegment {
  key: string
  label: string
  ariaLabel: string
  options: UiSegmentedOption[]
  model: string
  set: (value: string) => void
}

const styleSegments = computed<StyleSegment[]>(() => {
  const style = currentStyle.value
  return [
    { key: 'fill', label: 'Fill', ariaLabel: 'Fill style', options: fillOptions, model: style.fillStyle, set: setFill },
    { key: 'width', label: 'Width', ariaLabel: 'Stroke width', options: strokeWidthOptions, model: String(style.strokeWidth), set: setStrokeWidth },
    { key: 'stroke', label: 'Style', ariaLabel: 'Stroke style', options: strokeStyleOptions, model: style.strokeStyle, set: setStrokeStyle },
    { key: 'roughness', label: 'Sloppiness', ariaLabel: 'Sloppiness', options: roughnessOptions, model: String(style.roughness), set: setRoughness },
  ]
})

const textSegments = computed<StyleSegment[]>(() => {
  const textStyle = currentTextStyle.value
  return [
    { key: 'font', label: 'Font', ariaLabel: 'Font family', options: fontFamilyOptions, model: textStyle.fontFamily, set: setFontFamily },
    { key: 'size', label: 'Size', ariaLabel: 'Font size', options: fontSizeOptions, model: String(textStyle.fontSize), set: setFontSize },
    { key: 'align', label: 'Align', ariaLabel: 'Text alignment', options: alignOptions, model: textStyle.textAlign, set: setTextAlign },
  ]
})
</script>

<template>
  <UiPanel v-if="visible" position="bottom">
    <div class="style-panel">
      <section class="style-section">
        <span class="style-section__label">Stroke</span>
        <UiSwatchRow
          :colors="STROKE_PALETTE"
          :model-value="currentStyle.strokeColor"
          ariaLabel="Stroke color"
          @update:model-value="setStrokeColor"
        />
      </section>

      <section class="style-section">
        <span class="style-section__label">Background</span>
        <UiSwatchRow
          :colors="BACKGROUND_PALETTE"
          :model-value="currentStyle.backgroundColor"
          ariaLabel="Background color"
          @update:model-value="setBackgroundColor"
        />
      </section>

      <section v-if="cornersVisible" class="style-section">
        <span class="style-section__label">Corners</span>
        <UiSegmented
          :options="cornerOptions"
          :model-value="currentRoundness"
          ariaLabel="Corner style"
          @update:model-value="setRoundness"
        />
      </section>

      <section v-for="segment in styleSegments" :key="segment.key" class="style-section">
        <span class="style-section__label">{{ segment.label }}</span>
        <UiSegmented
          :options="segment.options"
          :model-value="segment.model"
          :ariaLabel="segment.ariaLabel"
          @update:model-value="segment.set"
        />
      </section>

      <section class="style-section">
        <span class="style-section__label">Opacity</span>
        <UiSlider
          :model-value="currentStyle.opacity"
          ariaLabel="Opacity"
          suffix="%"
          @update:model-value="setOpacity"
        />
      </section>

      <div v-if="textSectionVisible" class="style-panel__text-group">
        <section v-for="segment in textSegments" :key="segment.key" class="style-section">
          <span class="style-section__label">{{ segment.label }}</span>
          <UiSegmented
            :options="segment.options"
            :model-value="segment.model"
            :ariaLabel="segment.ariaLabel"
            @update:model-value="segment.set"
          />
        </section>
      </div>
    </div>
  </UiPanel>
</template>

<style scoped>
.style-panel {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 10px 16px;
}

.style-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.style-section__label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vd-ink-soft);
}

/* Text controls sit behind a hairline so the group reads as one region. */
.style-panel__text-group {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 10px 16px;
  padding-left: 16px;
  border-left: 1px solid var(--vd-border);
}
</style>
