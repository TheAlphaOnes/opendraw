<script lang="ts">
  import type { Component } from 'svelte'
  import type { IconName } from '@opendraw/editor'
  import {
    Circle,
    Diamond,
    Eraser,
    Frame,
    Hand,
    Image,
    Lock,
    LockOpen,
    Moon,
    MousePointer2,
    MoveRight,
    Pencil,
    Redo2,
    Slash,
    Square,
    StickyNote,
    Sun,
    Type,
    Undo2,
    WandSparkles,
    ZoomIn,
    ZoomOut,
  } from '@lucide/svelte'

  /** The editor's semantic icon names, mapped to Lucide glyphs (as in @opendraw/nuxt). */
  const ICONS: Partial<Record<IconName, Component<Record<string, unknown>>>> = {
    selection: MousePointer2,
    hand: Hand,
    rectangle: Square,
    diamond: Diamond,
    ellipse: Circle,
    arrow: MoveRight,
    line: Slash,
    freedraw: Pencil,
    text: Type,
    stickyNoteTool: StickyNote,
    imageTool: Image,
    eraser: Eraser,
    frameTool: Frame,
    laserTool: WandSparkles,
    undo: Undo2,
    redo: Redo2,
    lock: Lock,
    unlock: LockOpen,
    zoomIn: ZoomIn,
    zoomOut: ZoomOut,
    sun: Sun,
    moon: Moon,
  }

  let { name }: { name: IconName } = $props()
  const Glyph = $derived(ICONS[name] ?? Square)
</script>

<Glyph aria-hidden="true" strokeWidth={1.75} />
