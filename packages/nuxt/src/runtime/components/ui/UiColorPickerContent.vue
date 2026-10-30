<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  COLOR_OUTLINE_CONTRAST_THRESHOLD,
  COLOR_PICKER_HOTKEYS,
  COLORS_PER_ROW,
  DEFAULT_BACKGROUND_SHADE,
  DEFAULT_STROKE_SHADE,
  ELEMENT_COLOR_PALETTE,
  colorLabel,
  colorNameAndShade,
  inputColorError,
  isColorDark,
  isCustomColor,
  normalizeInputColor,
  paletteColorAt,
  themeColor,
} from '@opendraw/core'

import UiIcon from './UiIcon.vue'

/**
 * The color picker popover body — Excalidraw's <Picker>: most used custom
 * colors (1–5), the 5×3 base grid (q…b, shown at the active shade), the
 * current color's shades (⇧1–⇧5) and a hex field with an eyedropper (I).
 * Tab moves between sections and the arrows move inside one; picking
 * keeps the popover open, Escape closes it.
 */
const props = defineProps<{
  modelValue: string
  kind: 'stroke' | 'background'
  customColors: readonly string[]
  dark: boolean
}>()

const emit = defineEmits<{ change: [color: string]; close: [] }>()

type Section = 'custom' | 'baseColors' | 'shades' | 'hex'

const palette = ELEMENT_COLOR_PALETTE
const names = Object.keys(palette)
const rootRef = ref<HTMLElement | null>(null)
const hexRef = ref<HTMLInputElement | null>(null)

const current = computed(() => colorNameAndShade(palette, props.modelValue))
const activeShade = ref(
  current.value?.shade ?? (props.kind === 'background' ? DEFAULT_BACKGROUND_SHADE : DEFAULT_STROKE_SHADE),
)
watch(current, (value) => {
  if (value?.shade != null) {
    activeShade.value = value.shade
  }
})

const isCustom = computed(() => props.modelValue !== '' && isCustomColor(palette, props.modelValue))
const section = ref<Section | null>(
  isCustom.value
    ? props.customColors.includes(props.modelValue)
      ? 'custom'
      : null
    : current.value?.shade != null
      ? 'shades'
      : 'baseColors',
)

const grid = computed(() =>
  names.map((name, index) => ({
    name,
    color: paletteColorAt(palette[name]!, activeShade.value),
    hotkey: COLOR_PICKER_HOTKEYS[index]!,
  })),
)
const shades = computed(() => {
  const entry = current.value ? palette[current.value.name] : undefined
  return typeof entry === 'object' ? entry : null
})

const display = (color: string): string => themeColor(color, props.dark)
const ink = (color: string): string => (isColorDark(display(color)) ? '#fff' : '#000')
const outlined = (color: string): boolean => !isColorDark(color, COLOR_OUTLINE_CONTRAST_THRESHOLD)

function pick(color: string, from: Section): void {
  section.value = from
  if (color !== props.modelValue) {
    emit('change', color)
  }
}

// --- hex field ---------------------------------------------------------------
const hexValue = ref(props.modelValue)
const hexError = ref<string | null>(null)
watch(
  () => props.modelValue,
  (value) => {
    if (document.activeElement !== hexRef.value) {
      hexValue.value = value
    }
  },
)
function onHexInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  hexValue.value = value
  hexError.value = inputColorError(value)
  const color = normalizeInputColor(value)
  if (color) {
    pick(color, 'hex')
  }
}
function onHexBlur(): void {
  hexValue.value = props.modelValue
  hexError.value = null
}

// --- eyedropper (the platform EyeDropper where available) -------------------
interface EyeDropperLike {
  open: () => Promise<{ sRGBHex: string }>
}
const EyeDropperCtor =
  typeof window !== 'undefined' ? (window as unknown as { EyeDropper?: new () => EyeDropperLike }).EyeDropper : undefined
const sampling = ref(false)
async function sampleColor(): Promise<void> {
  if (!EyeDropperCtor || sampling.value) {
    return
  }
  sampling.value = true
  try {
    const { sRGBHex } = await new EyeDropperCtor().open()
    pick(sRGBHex.toLowerCase(), 'hex')
  } catch {
    // Dismissed with Escape — nothing to pick.
  } finally {
    sampling.value = false
    rootRef.value?.focus({ preventScroll: true })
  }
}

// --- keyboard (keyboardNavHandlers.ts) ---------------------------------------
function step(key: string, index: number, length: number): number | undefined {
  const rows = Math.ceil(length / COLORS_PER_ROW)
  switch (key) {
    case 'ArrowLeft':
      return index - 1 < 0 ? length - 1 : index - 1
    case 'ArrowRight':
      return (index + 1) % length
    case 'ArrowDown':
      return index + COLORS_PER_ROW >= length ? index % COLORS_PER_ROW : index + COLORS_PER_ROW
    case 'ArrowUp': {
      const prev = index - COLORS_PER_ROW
      const next = prev < 0 ? COLORS_PER_ROW * rows + prev : prev
      return next >= length ? undefined : next
    }
  }
  return undefined
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.target === hexRef.value && event.key !== 'Escape' && event.key !== 'Tab') {
    event.stopPropagation()
    return
  }
  if (event.metaKey || event.ctrlKey) {
    return
  }
  const handled = handleKey(event)
  if (handled) {
    event.preventDefault()
    event.stopPropagation()
  }
}

function handleKey(event: KeyboardEvent): boolean {
  if (event.key === 'Escape') {
    emit('close')
    return true
  }
  if (event.key === 'i' || event.key === 'I') {
    void sampleColor()
    return true
  }
  if (event.key === 'Tab') {
    const sections: Section[] = [
      ...(props.customColors.length > 0 ? (['custom'] as const) : []),
      'baseColors',
      ...(current.value?.shade != null ? (['shades'] as const) : []),
      'hex',
    ]
    const at = section.value ? sections.indexOf(section.value) : -1
    const next = sections[(at + (event.shiftKey ? -1 : 1) + sections.length) % sections.length]!
    section.value = next
    if (next === 'custom') {
      pick(props.customColors[0]!, 'custom')
    } else if (next === 'baseColors' && !current.value) {
      pick(paletteColorAt(palette.black!, activeShade.value), 'baseColors')
    } else if (next === 'hex') {
      hexRef.value?.focus()
    }
    return true
  }
  // ⇧1–⇧5 pick a shade of the current color (by code: Shift changes `key`).
  const digit = /^Digit([1-5])$/.exec(event.code)
  if (digit && event.shiftKey && shades.value) {
    pick(shades.value[Number(digit[1]) - 1]!, 'shades')
    return true
  }
  if (/^[1-5]$/.test(event.key) && props.customColors[Number(event.key) - 1]) {
    pick(props.customColors[Number(event.key) - 1]!, 'custom')
    return true
  }
  const hotkey = COLOR_PICKER_HOTKEYS.indexOf(event.key)
  if (hotkey > -1) {
    const cell = grid.value[hotkey]
    if (cell) {
      pick(cell.color, 'baseColors')
    }
    // Within the picker a dead key stays inert rather than reaching shortcuts.
    return true
  }
  if (section.value === 'shades' && shades.value && current.value?.shade != null) {
    const next = step(event.key, current.value.shade, COLORS_PER_ROW)
    if (next !== undefined) {
      pick(shades.value[next]!, 'shades')
      return true
    }
  }
  if (section.value === 'baseColors' && current.value) {
    const next = step(event.key, names.indexOf(current.value.name), names.length)
    if (next !== undefined) {
      pick(grid.value[next]!.color, 'baseColors')
      return true
    }
  }
  if (section.value === 'custom') {
    const next = step(event.key, Math.max(0, props.customColors.indexOf(props.modelValue)), props.customColors.length)
    if (next !== undefined) {
      pick(props.customColors[next]!, 'custom')
      return true
    }
  }
  return false
}

onMounted(() => rootRef.value?.focus({ preventScroll: true }))
</script>

<template>
  <div ref="rootRef" class="cp" tabindex="-1" @keydown="onKeyDown">
    <section v-if="props.customColors.length > 0" class="cp__section" style="--cp-i: 0">
      <h3 class="cp__heading">Most used custom colors</h3>
      <div class="cp__grid">
        <button
          v-for="(color, i) in props.customColors"
          :key="color"
          type="button"
          tabindex="-1"
          class="cp__swatch has-outline"
          :class="{ 'is-active': color === props.modelValue, 'is-transparent': color === 'transparent' }"
          :style="{ '--swatch': display(color) }"
          :title="color"
          :aria-label="`Most used custom colors ${color}`"
          @click="pick(color, 'custom')"
        >
          <span class="cp__hotkey" :style="{ color: ink(color) }">{{ i + 1 }}</span>
        </button>
      </div>
    </section>

    <section class="cp__section" style="--cp-i: 1">
      <h3 class="cp__heading">Colors</h3>
      <div class="cp__grid">
        <button
          v-for="cell in grid"
          :key="cell.name"
          type="button"
          tabindex="-1"
          class="cp__swatch"
          :class="{
            'is-active': current?.name === cell.name,
            'is-transparent': cell.color === 'transparent',
            'has-outline': outlined(cell.color),
          }"
          :style="{ '--swatch': display(cell.color) }"
          :title="`${colorLabel(cell.name)}${cell.color.startsWith('#') ? ` ${cell.color}` : ''} — ${cell.hotkey}`"
          :aria-label="`${colorLabel(cell.name)} — ${cell.hotkey}`"
          @click="pick(cell.color, 'baseColors')"
        >
          <span class="cp__hotkey" :style="{ color: ink(cell.color) }">{{ cell.hotkey }}</span>
        </button>
      </div>
    </section>

    <section class="cp__section" style="--cp-i: 2">
      <h3 class="cp__heading">Shades</h3>
      <div v-if="shades" class="cp__grid">
        <button
          v-for="(color, i) in shades"
          :key="color"
          type="button"
          tabindex="-1"
          class="cp__swatch"
          :class="{ 'is-active': i === current?.shade, 'has-outline': outlined(color) }"
          :style="{ '--swatch': display(color) }"
          :title="`${current?.name} - ${i + 1}`"
          aria-label="Shade"
          @click="pick(color, 'shades')"
        >
          <span class="cp__hotkey" :style="{ color: ink(color) }">⇧{{ i + 1 }}</span>
        </button>
      </div>
      <p v-else class="cp__empty">No shades available for this color</p>
    </section>

    <section class="cp__section" style="--cp-i: 3">
      <h3 class="cp__heading">Hex code</h3>
      <div class="cp__hex" :class="{ 'has-error': hexError }">
        <span class="cp__hash" aria-hidden="true">#</span>
        <input
          ref="hexRef"
          class="cp__input"
          :value="hexValue.replace(/^#/, '')"
          spellcheck="false"
          autocomplete="off"
          aria-label="Hex code"
          :aria-invalid="hexError !== null"
          @input="onHexInput"
          @focus="section = 'hex'"
          @blur="onHexBlur"
        />
        <template v-if="EyeDropperCtor">
          <span class="cp__divider" aria-hidden="true" />
          <button
            type="button"
            class="cp__dropper"
            :class="{ 'is-active': sampling }"
            title="Pick color from screen — I"
            aria-label="Pick color from screen"
            @click="sampleColor"
          >
            <UiIcon name="eyeDropper" :size="18" />
          </button>
        </template>
      </div>
      <p v-if="hexError" class="cp__error" role="alert">{{ hexError }}</p>
    </section>
  </div>
</template>

<style scoped>
.cp {
  display: flex;
  flex-direction: column;
  gap: 12px;
  outline: none;
}

/* Sections settle one after another, each at its own pace. */
.cp__section {
  animation: cp-rise calc(180ms + var(--cp-i) * 40ms) var(--od-ease) both;
  animation-delay: calc(var(--cp-i) * 28ms);
}

@keyframes cp-rise {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}

.cp__heading {
  margin: 0;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 400;
  color: var(--od-ink);
}

.cp__grid {
  display: grid;
  grid-template-columns: repeat(5, 30px);
  gap: 4px;
  padding: 8px;
}

.cp__swatch {
  position: relative;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: var(--swatch);
  cursor: pointer;
  transition:
    box-shadow var(--od-fast) ease-out,
    transform 90ms var(--od-ease);
}

.cp__swatch.has-outline {
  box-shadow: 0 0 0 1px var(--od-border);
}

.cp__swatch:hover:not(.is-active) {
  box-shadow: inset 0 0 0 1px var(--od-accent);
}

.cp__swatch:active {
  transform: scale(0.94);
}

.cp__swatch.is-active::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 6px;
  box-shadow: 0 0 0 1px var(--od-accent);
  animation: cp-ring 160ms var(--od-ease);
}

@keyframes cp-ring {
  from {
    transform: scale(0.86);
    opacity: 0;
  }
}

.cp__swatch.is-transparent {
  background-color: var(--od-surface-raised);
  background-image:
    linear-gradient(45deg, rgba(73, 80, 87, 0.25) 25%, transparent 25%, transparent 75%, rgba(73, 80, 87, 0.25) 75%),
    linear-gradient(45deg, rgba(73, 80, 87, 0.25) 25%, transparent 25%, transparent 75%, rgba(73, 80, 87, 0.25) 75%);
  background-position:
    0 0,
    5px 5px;
  background-size: 10px 10px;
}

.cp__hotkey {
  position: absolute;
  right: 4px;
  bottom: 2px;
  font: 500 10px ui-monospace, 'SF Mono', Menlo, monospace;
}

.cp__empty {
  margin: 0;
  padding: 14px 8px;
  font-size: 12px;
  text-align: center;
  color: var(--od-ink);
}

.cp__hex {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 8px;
  margin: 8px;
  padding: 0 12px;
  border: 1px solid var(--od-border);
  border-radius: 8px;
  transition: box-shadow var(--od-fast) ease-out;
}

.cp__hex:focus-within {
  box-shadow: 0 0 0 1px var(--od-accent);
}

.cp__hex.has-error {
  border-color: var(--od-danger);
}

.cp__hash {
  padding: 0 4px;
  color: var(--od-ink-soft);
}

.cp__input {
  width: 100%;
  height: 36px;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--od-ink);
  font: inherit;
  font-size: 14px;
  letter-spacing: 0.4px;
}

.cp__divider {
  width: 1px;
  height: 20px;
  background: var(--od-border);
}

.cp__dropper {
  display: inline-flex;
  padding: 4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--od-ink);
  cursor: pointer;
  transition: background-color var(--od-fast) ease-out;
}

.cp__dropper:hover,
.cp__dropper.is-active {
  background: var(--od-hover);
}

.cp__dropper:focus-visible {
  outline: 2px solid var(--od-accent);
  outline-offset: 1px;
}

.cp__error {
  margin: 0;
  padding: 0 8px 4px;
  font-size: 12px;
  color: var(--od-danger);
}
</style>
