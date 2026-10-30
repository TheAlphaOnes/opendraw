<script setup lang="ts">
import { computed } from 'vue'

import {
  BACKGROUND_PALETTE,
  ROUGHNESS_LEVELS,
  STROKE_PALETTE,
  STICKY_NOTE_BACKGROUND_PICKS,
  STROKE_WIDTHS,
  TRANSPARENT,
  mostUsedCustomColors,
  withBoundTexts,
  type ElementStyle,
  type FillStyle,
  type FontFamily,
  type Roughness,
  type StrokeStyle,
  type StrokeWidth,
  type TextAlign,
  type TextStyle,
  type OpenDrawTextElement,
} from '@opendraw/core'

import { useOpenDraw } from '../../composables/useOpenDraw.js'
import { panelTargets, type PanelTargets } from './panelTargets.js'
import ArrowheadPicker from './ArrowheadPicker.vue'
import SelectionActions from './SelectionActions.vue'
import StyleSection from './StyleSection.vue'
import UiPanel from '../ui/UiPanel.vue'
import UiSegmented, { type UiSegmentedOption } from '../ui/UiSegmented.vue'
import UiSlider from '../ui/UiSlider.vue'
import UiColorPicker from '../ui/UiColorPicker.vue'

/**
 * The properties island — Excalidraw's left-hand shape-properties panel.
 * It appears while something is selected or a drawing tool is armed, and
 * lists only the properties that apply to those element types. Edits
 * patch the selection, or set the defaults for the next element when
 * nothing is selected (the document decides which).
 */
const ctx = useOpenDraw()

/** Labels inside the selected shapes — styled through the text section. */
const labels = computed(() =>
  withBoundTexts(ctx.elements.value, ctx.selectedElements.value.map((el) => el.id)).filter(
    (el): el is OpenDrawTextElement => el.type === 'text' && el.containerId !== null,
  ),
)

const targets = computed<PanelTargets>(() =>
  panelTargets(ctx.selectedElements.value, ctx.activeTool.value, labels.value.length > 0),
)

// Current values: the first selected element, else the new-element defaults.
const first = computed(() => ctx.selectedElements.value[0] ?? null)
const style = computed<ElementStyle>(() => {
  const el = first.value
  if (!el && ctx.activeTool.value === 'stickynote') {
    return { ...ctx.appState.value.style, ...ctx.appState.value.stickyNoteStyle }
  }
  return el
    ? {
        strokeColor: el.strokeColor,
        backgroundColor: el.backgroundColor,
        fillStyle: el.fillStyle,
        strokeWidth: el.strokeWidth,
        strokeStyle: el.strokeStyle,
        roughness: el.roughness,
        opacity: el.opacity,
      }
    : ctx.appState.value.style
})
const textStyle = computed<TextStyle>(() => {
  const el = ctx.selectedElements.value.find((e): e is OpenDrawTextElement => e.type === 'text') ?? labels.value[0]
  return el
    ? { fontSize: el.baseFontSize ?? el.fontSize, fontFamily: el.fontFamily, textAlign: el.textAlign }
    : ctx.appState.value.textStyle
})
const roundness = computed(() => {
  const el = first.value
  const value =
    el && (el.type === 'rectangle' || el.type === 'diamond' || el.type === 'line' || el.type === 'stickynote')
      ? el.roundness
      : ctx.appState.value.shapeRoundness
  return value === 'round' ? 'round' : 'sharp'
})
const arrowType = computed(() => {
  const el = ctx.selectedElements.value.find((e) => e.type === 'arrow')
  return el && el.type === 'arrow' ? (el.roundness === 'round' ? 'round' : 'sharp') : ctx.appState.value.arrowType
})

const dark = computed(() => ctx.theme.value === 'dark')
// The picker's "most used custom colors": canvas colors outside the palette.
const customStrokeColors = computed(() => mostUsedCustomColors(ctx.elements.value, 'strokeColor'))
const customBackgroundColors = computed(() => mostUsedCustomColors(ctx.elements.value, 'backgroundColor'))

// Excalidraw shows fill patterns only once there is a background to fill.
const showFill = computed(() => targets.value.fill && style.value.backgroundColor !== TRANSPARENT)

const fillOptions: UiSegmentedOption[] = [
  { value: 'hachure', label: 'Hachure fill', icon: 'fillHachure' },
  { value: 'cross-hatch', label: 'Cross-hatch fill', icon: 'fillCrossHatch' },
  { value: 'solid', label: 'Solid fill', icon: 'fillSolid' },
]
const strokeWidthOptions: UiSegmentedOption[] = [
  { value: String(STROKE_WIDTHS.thin), label: 'Thin stroke', icon: 'strokeThin' },
  { value: String(STROKE_WIDTHS.medium), label: 'Bold stroke', icon: 'strokeMedium' },
  { value: String(STROKE_WIDTHS.bold), label: 'Extra bold stroke', icon: 'strokeBold' },
]
const strokeStyleOptions: UiSegmentedOption[] = [
  { value: 'solid', label: 'Solid line', text: 'Solid' },
  { value: 'dashed', label: 'Dashed line', text: 'Dashed' },
  { value: 'dotted', label: 'Dotted line', text: 'Dotted' },
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
const arrowTypeOptions: UiSegmentedOption[] = [
  { value: 'sharp', label: 'Sharp arrow', icon: 'arrowSharp' },
  { value: 'round', label: 'Curved arrow', icon: 'arrowRound' },
]
const fontFamilyOptions: UiSegmentedOption[] = [
  { value: 'hand', label: 'Hand-drawn font', text: 'Hand' },
  { value: 'normal', label: 'Normal font', text: 'Normal' },
  { value: 'code', label: 'Code font', text: 'Code' },
]
// Excalidraw's S / M / L / XL presets.
const fontSizeOptions: UiSegmentedOption[] = [
  { value: '16', label: 'Small text', text: 'S' },
  { value: '20', label: 'Medium text', text: 'M' },
  { value: '28', label: 'Large text', text: 'L' },
  { value: '36', label: 'Extra large text', text: 'XL' },
]
const alignOptions: UiSegmentedOption[] = [
  { value: 'left', label: 'Align left', icon: 'alignLeft' },
  { value: 'center', label: 'Align center', icon: 'alignCenter' },
  { value: 'right', label: 'Align right', icon: 'alignRight' },
]
</script>

<template>
  <UiPanel v-if="targets.visible" position="properties">
    <div class="style-panel" role="region" aria-label="Element properties">
      <StyleSection v-if="targets.stroke" :label="targets.notes ? 'Text color' : 'Stroke'">
        <UiColorPicker
          kind="stroke"
          :label="targets.notes ? 'Text' : 'Stroke'"
          :top-picks="STROKE_PALETTE"
          :model-value="style.strokeColor"
          :custom-colors="customStrokeColors"
          :dark="dark"
          @update:model-value="ctx.changeStyle({ strokeColor: $event })"
        />
      </StyleSection>
      <StyleSection v-if="targets.background" label="Background">
        <UiColorPicker
          kind="background"
          label="Background"
          :top-picks="targets.notes ? STICKY_NOTE_BACKGROUND_PICKS : BACKGROUND_PALETTE"
          :model-value="style.backgroundColor"
          :custom-colors="customBackgroundColors"
          :dark="dark"
          @update:model-value="ctx.changeStyle({ backgroundColor: $event })"
        />
      </StyleSection>
      <StyleSection v-if="showFill" label="Fill">
        <UiSegmented
          block
          :options="fillOptions"
          :model-value="style.fillStyle"
          ariaLabel="Fill style"
          @update:model-value="ctx.changeStyle({ fillStyle: $event as FillStyle })"
        />
      </StyleSection>
      <StyleSection v-if="targets.strokeShape" label="Stroke width">
        <UiSegmented
          block
          :options="strokeWidthOptions"
          :model-value="String(style.strokeWidth)"
          ariaLabel="Stroke width"
          @update:model-value="ctx.changeStyle({ strokeWidth: Number($event) as StrokeWidth })"
        />
      </StyleSection>
      <StyleSection v-if="targets.strokeShape" label="Stroke style">
        <UiSegmented
          block
          :options="strokeStyleOptions"
          :model-value="style.strokeStyle"
          ariaLabel="Stroke style"
          @update:model-value="ctx.changeStyle({ strokeStyle: $event as StrokeStyle })"
        />
      </StyleSection>
      <StyleSection v-if="targets.sloppiness" label="Sloppiness">
        <UiSegmented
          block
          :options="roughnessOptions"
          :model-value="String(style.roughness)"
          ariaLabel="Sloppiness"
          @update:model-value="ctx.changeStyle({ roughness: Number($event) as Roughness })"
        />
      </StyleSection>
      <StyleSection v-if="targets.corners" label="Edges">
        <UiSegmented
          block
          :options="cornerOptions"
          :model-value="roundness"
          ariaLabel="Corner style"
          @update:model-value="ctx.changeRoundness($event === 'round' ? 'round' : null)"
        />
      </StyleSection>
      <StyleSection v-if="targets.arrowheads" label="Arrow type">
        <UiSegmented
          block
          :options="arrowTypeOptions"
          :model-value="arrowType"
          ariaLabel="Arrow type"
          @update:model-value="ctx.editor.changeArrowType($event === 'round' ? 'round' : 'sharp')"
        />
      </StyleSection>
      <StyleSection v-if="targets.arrowheads" label="Arrowheads">
        <ArrowheadPicker />
      </StyleSection>
      <template v-if="targets.text">
        <StyleSection label="Font family">
          <UiSegmented
            block
            :options="fontFamilyOptions"
            :model-value="textStyle.fontFamily"
            ariaLabel="Font family"
            @update:model-value="ctx.changeTextStyle({ fontFamily: $event as FontFamily })"
          />
        </StyleSection>
        <StyleSection label="Font size">
          <UiSegmented
            block
            :options="fontSizeOptions"
            :model-value="String(textStyle.fontSize)"
            ariaLabel="Font size"
            @update:model-value="ctx.changeTextStyle({ fontSize: Number($event) })"
          />
        </StyleSection>
        <StyleSection label="Text align">
          <UiSegmented
            block
            :options="alignOptions"
            :model-value="textStyle.textAlign"
            ariaLabel="Text alignment"
            @update:model-value="ctx.changeTextStyle({ textAlign: $event as TextAlign })"
          />
        </StyleSection>
      </template>
      <StyleSection label="Opacity">
        <UiSlider
          :model-value="style.opacity"
          ariaLabel="Opacity"
          suffix="%"
          @update:model-value="ctx.changeStyle({ opacity: $event })"
        />
      </StyleSection>
      <SelectionActions v-if="ctx.selectedElements.value.length > 0" />
    </div>
  </UiPanel>
</template>

<style scoped>
.style-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px;
}
</style>
