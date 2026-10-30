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
  type LucideIcon,
} from 'lucide-react'

import type { IconName } from '@opendrawjs/editor'

/** The editor's semantic icon names, mapped to Lucide glyphs (as in @opendrawjs/nuxt). */
const ICONS: Partial<Record<IconName, LucideIcon>> = {
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

export function Icon({ name }: { name: IconName }) {
  const Glyph = ICONS[name] ?? Square
  return <Glyph aria-hidden="true" strokeWidth={1.75} />
}
