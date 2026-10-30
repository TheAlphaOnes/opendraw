<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  BACKGROUND_PALETTE,
  ROUGHNESS_LEVELS,
  STROKE_PALETTE,
  STICKY_NOTE_BACKGROUND_PICKS,
  STROKE_WIDTHS,
  TRANSPARENT,
  mostUsedCustomColors,
  withBoundTexts,
  type ArrowType,
  type ElementStyle,
  type FillStyle,
  type FontFamily,
  type Roughness,
  type StrokeStyle,
  type StrokeWidth,
  type TextAlign,
  type TextStyle,
  type OpenDrawTextElement,
} from '@opendrawjs/core'

import { ARROW_TYPE_OPTIONS } from '@opendrawjs/editor'

import { useOpenDraw } from '../../composables/useOpenDraw.js'
import { panelTargets, type PanelTargets } from './panelTargets.js'
import ArrowheadPicker from './ArrowheadPicker.vue'
import SelectionActions from './SelectionActions.vue'
import StyleSection from './StyleSection.vue'
import UiPanel from '../ui/UiPanel.vue'
import UiSegmented, { type UiSegmentedOption } from '../ui/UiSegmented.vue'
import UiSlider from '../ui/UiSlider.vue'
import UiColorPicker from '../ui/UiColorPicker.vue'
import UiIcon from '../ui/UiIcon.vue'

/**
 * The properties island — Excalidraw's left-hand shape-properties panel.
 * It appears while something is selected or a drawing tool is armed, and
 * lists only the properties that apply to those element types. Edits
 * patch the selection, or set the defaults for the next element when
 * nothing is selected (the document decides which).
 */
const ctx = useOpenDraw()

/**
 * Phones: the panel collapses to a "Properties" bar above the toolbar so
 * the canvas stays visible; a tap expands the sheet. Desktop never shows
 * the bar and always shows the panel.
 */
const expanded = ref(false)

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
  return el && el.type === 'arrow'
    ? el.elbowed
      ? 'elbow'
      : el.roundness === 'round'
        ? 'round'
        : 'sharp'
    : ctx.appState.value.arrowType
})

const dark = computed(() => ctx.theme.value === 'dark')
// The picker's "most used custom colors": canvas colors outside the palette.
const customStrokeColors = computed(() => mostUsedCustomColors(ctx.elements.value, 'strokeColor'))
const customBackgroundColors = computed(() => mostUsedCustomColors(ctx.elements.value, 'backgroundColor'))

// Excalidraw shows fill patterns only once there is a background to fill.
const showFill = computed(() => targets.value.fill && style.value.backgroundColor !== TRANSPARENT)

const fillOptions: UiSegmentedOption[] = [
  { value: 'hachure', label: 'Hachure', glyph: 'fillHachure' },
  { value: 'cross-hatch', label: 'Cross-hatch', glyph: 'fillCrossHatch' },
  { value: 'solid', label: 'Solid', glyph: 'fillSolid' },
]
const strokeWidthOptions: UiSegmentedOption[] = [
  { value: String(STROKE_WIDTHS.thin), label: 'Thin', glyph: 'strokeThin' },
  { value: String(STROKE_WIDTHS.medium), label: 'Bold', glyph: 'strokeBold' },
  { value: String(STROKE_WIDTHS.bold), label: 'Extra bold', glyph: 'strokeExtraBold' },
]
const strokeStyleOptions: UiSegmentedOption[] = [
  { value: 'solid', label: 'Solid', glyph: 'strokeSolid' },
  { value: 'dashed', label: 'Dashed', glyph: 'strokeDashed' },
  { value: 'dotted', label: 'Dotted', glyph: 'strokeDotted' },
]
const roughnessOptions: UiSegmentedOption[] = [
  { value: String(ROUGHNESS_LEVELS.architect), label: 'Architect', glyph: 'sloppinessArchitect' },
  { value: String(ROUGHNESS_LEVELS.artist), label: 'Artist', glyph: 'sloppinessArtist' },
  { value: String(ROUGHNESS_LEVELS.cartoonist), label: 'Cartoonist', glyph: 'sloppinessCartoonist' },
]
const cornerOptions: UiSegmentedOption[] = [
  { value: 'sharp', label: 'Sharp', glyph: 'edgeSharp' },
  { value: 'round', label: 'Round', glyph: 'edgeRound' },
]
// Excalidraw's three arrow types, glyphs shared with every adapter.
const arrowTypeOptions: UiSegmentedOption[] = ARROW_TYPE_OPTIONS.map((option) => ({
  value: option.type,
  label: option.label,
  glyph: option.type === 'sharp' ? 'arrowSharp' : option.type === 'round' ? 'arrowRound' : 'arrowElbow',
}))
const fontFamilyOptions: UiSegmentedOption[] = [
  { value: 'hand', label: 'Hand-drawn', icon: 'fontHand' },
  { value: 'normal', label: 'Normal', icon: 'fontNormal' },
  { value: 'code', label: 'Code', icon: 'fontCode' },
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
    <button
      type="button"
      class="style-panel__toggle"
      :aria-expanded="expanded"
      aria-controls="opendraw-style-panel"
      @click="expanded = !expanded"
    >
      <span class="style-panel__swatch" :style="{ background: style.strokeColor }" aria-hidden="true" />
      <span class="style-panel__swatch style-panel__swatch--fill" :style="{ background: style.backgroundColor }" aria-hidden="true" />
      <span class="style-panel__toggle-label">Properties</span>
      <UiIcon name="chevronDown" :size="16" class="style-panel__chevron" />
    </button>
    <div
      id="opendraw-style-panel"
      class="style-panel"
      :class="{ 'is-collapsed': !expanded }"
      role="region"
      aria-label="Element properties"
    >
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
          :options="fillOptions"
          :model-value="style.fillStyle"
          ariaLabel="Fill style"
          @update:model-value="ctx.changeStyle({ fillStyle: $event as FillStyle })"
        />
      </StyleSection>
      <StyleSection v-if="targets.strokeShape" label="Stroke width">
        <UiSegmented
          :options="strokeWidthOptions"
          :model-value="String(style.strokeWidth)"
          ariaLabel="Stroke width"
          @update:model-value="ctx.changeStyle({ strokeWidth: Number($event) as StrokeWidth })"
        />
      </StyleSection>
      <StyleSection v-if="targets.strokeShape" label="Stroke style">
        <UiSegmented
          :options="strokeStyleOptions"
          :model-value="style.strokeStyle"
          ariaLabel="Stroke style"
          @update:model-value="ctx.changeStyle({ strokeStyle: $event as StrokeStyle })"
        />
      </StyleSection>
      <StyleSection v-if="targets.sloppiness" label="Sloppiness">
        <UiSegmented
          :options="roughnessOptions"
          :model-value="String(style.roughness)"
          ariaLabel="Sloppiness"
          @update:model-value="ctx.changeStyle({ roughness: Number($event) as Roughness })"
        />
      </StyleSection>
      <StyleSection v-if="targets.corners" label="Edges">
        <UiSegmented
          :options="cornerOptions"
          :model-value="roundness"
          ariaLabel="Corner style"
          @update:model-value="ctx.changeRoundness($event === 'round' ? 'round' : null)"
        />
      </StyleSection>
      <StyleSection v-if="targets.arrowheads" label="Arrow type">
        <UiSegmented
          :options="arrowTypeOptions"
          :model-value="arrowType"
          ariaLabel="Arrow type"
          @update:model-value="ctx.changeArrowType($event as ArrowType)"
        />
      </StyleSection>
      <StyleSection v-if="targets.arrowheads" label="Arrowheads">
        <ArrowheadPicker />
      </StyleSection>
      <template v-if="targets.text">
        <StyleSection label="Font family">
          <UiSegmented
              :options="fontFamilyOptions"
            :model-value="textStyle.fontFamily"
            ariaLabel="Font family"
            @update:model-value="ctx.changeTextStyle({ fontFamily: $event as FontFamily })"
          />
        </StyleSection>
        <StyleSection label="Font size">
          <UiSegmented
              :options="fontSizeOptions"
            :model-value="String(textStyle.fontSize)"
            ariaLabel="Font size"
            @update:model-value="ctx.changeTextStyle({ fontSize: Number($event) })"
          />
        </StyleSection>
        <StyleSection label="Text align">
          <UiSegmented
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
/* Excalidraw's .selected-shape-actions: sections 8px apart. */
.style-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.style-panel__toggle {
  display: none;
}

@media (max-width: 640px) {
  .style-panel__toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 32px;
    padding: 0 4px;
    border: none;
    border-radius: var(--od-radius-m);
    background: transparent;
    color: var(--od-ink);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }

  .style-panel__toggle:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--od-accent);
  }

  .style-panel__toggle-label {
    flex: 1;
    text-align: left;
  }

  .style-panel__swatch {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    box-shadow: 0 0 0 1px var(--od-divider);
  }

  .style-panel__chevron {
    color: var(--od-ink-soft);
    transform: rotate(180deg);
    transition: transform 220ms var(--od-ease);
  }

  .style-panel__toggle[aria-expanded='true'] .style-panel__chevron {
    transform: none;
  }

  .style-panel {
    margin-top: 8px;
    animation: style-panel-open 240ms var(--od-ease) both;
  }

  .style-panel.is-collapsed {
    display: none;
  }
}

@keyframes style-panel-open {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
</style>
